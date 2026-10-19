# Research: Sincronización de datos de finanzas (PUSH/PULL)

Decisiones técnicas de la feature [004-data-sync](./spec.md). Continúa la numeración de la spec 003 con el prefijo **S** para no confundirlas con las R1–R16 de esa spec.

## S1. Ningún cambio confirmado detrás de un cursor (FR-019)

**Problema**: `server_updated_at` se asigna **antes** del commit. Un PUSH lento podría marcar un registro a las 10:00:00.100 y confirmar a las 10:00:00.900. Un PULL que lea a las 10:00:00.500 y devuelva un registro marcado a las 10:00:00.400 entregaría el cursor 10:00:00.400. El registro del PUSH lento, con marca anterior, quedaría detrás del cursor para siempre.

**Decision**: **advisory lock de PostgreSQL por usuario**, a nivel de transacción:
- El PUSH toma `pg_advisory_xact_lock(<clave del usuario>)`, que es **exclusivo**.
- El PULL toma `pg_advisory_xact_lock_shared(<clave del usuario>)`, que es **compartido**.
- La clave es un `bigint` derivado del `user_id` (los 8 primeros bytes del UUID), con un espacio de nombres propio para no chocar con el lock del bootstrap.

Con esto, un PULL nunca lee mientras haya un PUSH del mismo usuario sin confirmar, y un PUSH que empieza después de un PULL asigna marcas posteriores a todo lo que ese PULL leyó. Los PULL entre sí no se bloquean, y los usuarios distintos tampoco.

**Rationale**:
- Las únicas escrituras de datos de finanzas son el PUSH y el alta de usuario. El alta crea las categorías iniciales en la misma transacción que el usuario, antes de que exista cualquier sesión, así que no compite con un PULL.
- Es la solución más simple que garantiza la propiedad sin ventanas de tiempo arbitrarias (Principio V).
- Bloquear PUSH contra PULL del **mismo** usuario no tiene coste práctico: es una app personal con pocos dispositivos por usuario.
- **Regla para el futuro**: cualquier escritor de datos de finanzas en el servidor (p. ej. la generación de débitos de suscripciones) MUST pasar por el mismo lock. El núcleo de sync lo expone como función reutilizable (`user_sync_lock`).

**Alternatives considered**:
- *Margen de solapamiento* (el PULL relee los últimos N segundos): reduce el riesgo pero no lo elimina, ya que un PUSH puede tardar más que N. Además genera repeticiones que la app debe tolerar.
- *Secuencia `bigint` + `pg_snapshot_xmin`*: es correcta y no bloquea, pero necesita migración, más lógica y es difícil de probar.
- *Aislamiento SERIALIZABLE*: no resuelve el orden de las marcas frente a los commits y añade reintentos.

## S2. Fuente de la marca del servidor

**Decision**: el PUSH asigna `server_updated_at = clock_timestamp()` **en la base de datos** (columna con ese default, y explícito en el `UPDATE`). El reloj inyectable `Clock` sigue usándose para la regla de reloj adelantado (FR-013).

Para tener una sola fuente, `UserScopedRepository.add/touch` también pasan a usar `clock_timestamp()` de la base. Hoy usan `Clock.now()`. Se ajustarán las pruebas de la seed que comparen con el reloj congelado.

**Rationale**: con S1, la monotonía de los cursores depende de que todas las marcas vengan del mismo reloj. Varias réplicas de la API tendrían relojes distintos, y la base es una sola.

**Riesgo aceptado**: un salto hacia atrás del reloj del servidor de base de datos (corrección NTP brusca) podría dar marcas menores que un cursor ya entregado. Es poco probable en un servidor con NTP gradual. Si apareciera, la solución sería S1-alternativa (secuencia).

**Alternatives considered**: `Clock.now()` de la app, que da buena testabilidad pero varias fuentes si hay réplicas.

## S3. Formato del cursor y paginación del PULL

**Decision**:
- El **cursor es opaco** para la app: base64url de `{"t": "<server_updated_at ISO>", "id": "<uuid>"}`, es decir, la posición del último registro entregado.
- La consulta es por *keyset*: `WHERE user_id = :u AND (server_updated_at, id) > (:t, :id) ORDER BY server_updated_at, id LIMIT :n`.
- Hay un **límite global por respuesta** (`PULL_PAGE_SIZE = 1000`, configurable) que se reparte entre las tablas en orden de dependencias. Cada tabla devuelve su `cursor` y su `hasMore`. La app repite el PULL con los cursores nuevos hasta que todas las tablas tengan `hasMore = false`.
- Si un cursor está mal formado, el PULL responde 422 con `INVALID_CURSOR`. La app descarta ese cursor y hace sync completo de esa tabla.

**Rationale**: incluir `id` en el cursor evita perder o repetir registros con la misma marca (FR-018). Que sea opaco permite cambiar el mecanismo (S1-alternativa) sin cambiar la app. El orden de dependencias hace que la app reciba primero los registros referenciados.

**Impacto en la app**: `sync_metadata.last_pulled_server_at` guarda el cursor opaco. Se renombrará a `pull_cursor` en `docs/db-finanzas.md` (cambio documental; el cliente aún no existe). Con esto, FR-020 se cumple devolviendo también `serverUpdatedAt` en cada registro, que la app guarda como copia informativa.

**Alternatives considered**: cursor = solo timestamp (repite o pierde registros con la misma marca); paginación por tabla con peticiones separadas (más idas y vueltas).

## S4. Escritura LWW atómica y detección de IDs ajenos

**Decision**: un solo `INSERT ... ON CONFLICT (id) DO UPDATE SET ... WHERE <tabla>.user_id = :u AND excluded.updated_at > <tabla>.updated_at RETURNING id`.
- **Devuelve fila** → `APPLIED` (creado o sobrescrito).
- **No devuelve fila** → una consulta con alcance de usuario decide:
  - Si existe para el usuario → `DISCARDED` (el servidor tiene una versión igual o más reciente).
  - Si no existe para el usuario → el ID pertenece a otro usuario → `REJECTED` con `ID_CONFLICT`. El mensaje es genérico y no revela nada.

El `user_id` de la fila se asigna siempre desde la sesión, nunca desde el registro.

**Rationale**: una sola sentencia sin carreras. La condición `user_id = :u` dentro del `DO UPDATE` impide sobrescribir filas ajenas aunque la lógica de la app fallara (defensa en profundidad, Principio III).

**Alternatives considered**: `SELECT ... FOR UPDATE` + `INSERT/UPDATE` (dos sentencias, y la consulta sin filtro de usuario rompería la regla del repositorio).

## S5. Aislamiento de errores por registro dentro de un lote (Clarificación 1)

**Decision**: el PUSH es **una transacción** y cada registro se escribe dentro de un **SAVEPOINT** (`session.begin_nested()`). Si la base rechaza un registro (`IntegrityError`: índice único parcial de categorías, `UNIQUE (subscription_id, subscription_period)`, CHECK no previsto), se revierte solo ese savepoint. El nombre de la restricción se traduce a un código (`DUPLICATE`, `VALIDATION_ERROR`).

**Rationale**:
- Cumple "resultado por registro" sin abrir una transacción por registro.
- El lock de S1 se mantiene durante todo el lote.
- Las validaciones previas de Pydantic, referencias y coherencia evitan la mayoría de los viajes a la base. El savepoint es la red de seguridad.

**Alternatives considered**: transacción por registro (soltaría el lock entre registros y multiplica commits); todo o nada (descartado en la clarificación).

## S6. Orden de aplicación y dependencias dentro del lote (FR-010, FR-011)

**Decision**:
- **Entre tablas**: orden fijo declarado en el registro de entidades: `categories`, `reimbursement_groups`, `assets` → `accounts` → `subscriptions`, `recurring_incomes`, `cdts` → `transactions`.
- **Dentro de una tabla con autorreferencia** (`accounts.parent_account_id`, `cdts.renewed_from_cdt_id`): orden topológico de los registros del lote. Si hay un ciclo, todos los registros del ciclo se rechazan con `INVALID_REFERENCE`.
- **Contexto del lote** (`BatchContext`): por tabla, guarda los IDs aplicados o existentes y los rechazados, más una vista de los registros aceptados en el lote (para la coherencia, p. ej. el `kind` de una categoría que llega en el mismo lote).
- **Resolución de una referencia**, en orden:
  1. Si apunta a un ID rechazado en el lote → `DEPENDENCY_REJECTED`.
  2. Si está aceptada en el lote → válida.
  3. Si existe en la base para el usuario, **incluidas las borradas lógicamente** → válida.
  4. En otro caso → `INVALID_REFERENCE`.
- **Rendimiento**: antes de procesar una tabla, sus referencias se resuelven con **una consulta por tabla referenciada** (`WHERE user_id = :u AND id = ANY(:ids)`), que trae también los campos que necesita la coherencia (`kind`, `type`, `parent_account_id`).

**Rationale**: la app puede enviar los registros en cualquier orden. Las consultas agrupadas mantienen el lote de 500 registros en pocas decenas de consultas.

## S7. Validación por entidad y reglas de coherencia (FR-009, FR-009a, Clarificación 3)

**Decision**: cada entidad define:
1. **Esquema Pydantic del registro** (entrada y salida): tipos, enums como `Literal`, longitudes, rangos y reglas de un solo registro (p. ej. `TRANSFER` ⇔ `counterAccountId`, `billingMonth` obligatorio en `YEARLY`, `CREDIT_CARD` ⇒ `LIABILITY`).
2. **Referencias**: lista declarativa `(campo, tabla destino)`.
3. **Coherencia**: método `check_coherence(record, refs)` con las reglas de FR-009a, que usa los datos de las referencias resueltas en S6.

Los errores de Pydantic de un registro se convierten en `REJECTED / VALIDATION_ERROR` con `details` (campo y mensaje). Nunca hacen fallar la petición entera.

**Rationale**: la petición se parsea en dos niveles. El sobre (`changes: {tabla: [objeto]}`) se valida de forma estricta, con tabla desconocida → 422. Cada registro se valida de forma individual, lo que hace posible el resultado por registro.

## S8. Montos y números exactos (FR-004, SC-007)

**Decision**: tipos anotados en `app/common/schemas.py`:
- `MoneyStr`: acepta **solo string** con el patrón `^\d{1,12}(\.\d{1,2})?$` y se convierte en `Decimal`. Se serializa como string con 2 decimales.
- `RateStr` (7,4) y `PercentStr` (5,2): la misma idea con sus escalas.

Un número JSON (`1234.5`) se rechaza: un float podría haber perdido precisión antes de llegar. Nunca se redondea.

**Rationale**: Principio IV; los montos llegan y salen idénticos.

## S9. Límites y reloj adelantado (FR-013, FR-014)

**Decision**: constantes en `sync/core/config.py`:
- `MAX_PUSH_RECORDS = 500`. Superarlo → **413** `PUSH_TOO_LARGE` sin aplicar nada.
- `PULL_PAGE_SIZE = 1000`.
- `MAX_FUTURE_SKEW = 24 h`. Un `updated_at > Clock.now() + 24 h` → `REJECTED / CLOCK_AHEAD`.

También se limita el tamaño del cuerpo a 2 MB en la ruta de PUSH, para cortar peticiones abusivas antes de parsearlas.

## S10. Forma de las rutas

**Decision**: `POST /api/v1/sync/push` y `POST /api/v1/sync/pull`. El PULL es POST porque lleva un objeto de cursores por tabla, que no cabe bien en la query string, aunque no modifica datos. Ambas rutas están protegidas por el guard global. Se mantiene `GET /api/v1/categories` (FR-022).

**Alternatives considered**: `GET /sync/pull?cursors=<json>` (URLs largas y poco legibles); rutas por tabla (contradice FR-001).

## S11. Pruebas

**Decision**: siguen el esquema de la spec 003 (pytest + testcontainers):
- **unit**: cursor (ida y vuelta, cursor inválido), orden topológico y ciclos, `MoneyStr`, reglas de coherencia por entidad con referencias simuladas.
- **integration**: PUSH/PULL de cada entidad, LWW (más nuevo, igual, más viejo), idempotencia (reenviar 1–5 veces), dependencias en el mismo lote y en cascada, IDs ajenos, aislamiento entre usuarios, paginación con marcas repetidas, primer PULL con las 15 categorías, ida y vuelta de montos (`0.10`, `0.20`, `0.30`) y reloj adelantado.
- **concurrencia** (FR-019, SC-004): dos conexiones reales del `engine`, no el `db_session` compartido. Un PUSH retenido antes del commit y un PULL simultáneo; se comprueba que el PULL espera y que el siguiente PULL con su cursor recibe el registro.
- **contract**: la arquitectura existente (los controladores no tocan la base) cubre el nuevo controlador; además, las rutas de sync exigen sesión.
