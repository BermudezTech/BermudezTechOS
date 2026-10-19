# Research: Migración de movimientos desde la base antigua

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-10-18

## R1. Lectura del dump

- **Decision**: leer el archivo SQL como texto y extraer solo las líneas `INSERT INTO movements (...) VALUES (...);` con una expresión regular estricta. Cada línea es una fila. No se ejecuta el SQL ni se levanta MySQL/MariaDB.
- **Rationale**: el dump es de MySQL/MariaDB (backticks, `ENGINE=InnoDB`), así que no se puede cargar en PostgreSQL. Revisado el archivo:
  - las 2.149 filas de `movements` son una por línea;
  - ninguna descripción contiene comillas escapadas (`\'` ni `''`);
  - hay finales de línea mixtos (CRLF y LF) y espacios al final.

  La regex tolera `\r` y espacios finales. Cualquier línea `INSERT INTO movements` que no encaje aborta la ejecución (R8), así un cambio de formato no se pierde en silencio.
- **Alternatives considered**: cargar el dump en un contenedor MariaDB y leerlo con un cliente SQL (más fiel, pero añade infraestructura para una carga única); un parser SQL genérico (dependencia pesada para un formato trivial).

## R2. Emparejamiento de transferencias

- **Decision**: emparejar a partir de `movements`:
  - Candidatas: filas incluidas cuya descripción coincide con `^transferencia (a|desde)` (sin distinguir mayúsculas).
  - Se recorren las patas negativas en orden de id. A cada una se le asigna la primera pata positiva aún libre, en orden de id, con la misma fecha, el mismo valor absoluto y una ubicación antigua distinta.
  - Si las dos patas caen en la misma cuenta nueva (1 ↔ 8), el par se descarta (FR-006a).
- **Rationale**: una prueba sobre el dump real da 429 candidatas ("Transferencia adelanto por viáticos" no cuenta: la regla exige la palabra completa "a" o "desde"), 208 pares (7 de ellos Efectivo ↔ Bolsillo) y 13 patas sueltas. El recorrido ordenado hace el resultado determinista (FR-009). Cualquier emparejamiento entre cuentas conserva los saldos, porque una transferencia resta del origen y suma al destino exactamente lo que restaban y sumaban las dos patas.
- **Alternatives considered**: usar la tabla `transfers` como guía. Se descartó porque 16 de sus 210 filas no tienen patas con su misma fecha y monto (diferencias de un día, montos que no coinciden, patas que no existen).

## R3. IDs deterministas e idempotencia

- **Decision**: UUIDv5 con un namespace fijo del script. El namespace es `uuidv5(NAMESPACE_URL, "https://bermudeztech.os/legacy-migration/2026-10")`, calculado una vez y escrito como constante.
  - Ingreso o egreso: `uuidv5(NS, "movement:<id>")`.
  - Transferencia: `uuidv5(NS, "transfer:<idSalida>:<idEntrada>")`.
  - Cuenta nueva: `uuidv5(NS, "account:<clave>")`, con clave `cash`, `nequi`, `bancolombia`, `alamano` o `global66`.

  Las inserciones usan `ON CONFLICT (id) DO NOTHING RETURNING id`, que permite contar insertados frente a ya existentes.
- **Rationale**: es la misma técnica que ya usa la constitución para los débitos de suscripciones (Principio II). Re-ejecutar con el mismo dump produce los mismos IDs y no inserta nada nuevo. Si el usuario editó en la app un movimiento migrado, `DO NOTHING` no lo pisa.
- **Alternatives considered**: una tabla de control `legacy_migration_map` (requiere migración Alembic para una carga única); UUIDv4 + comprobar por descripción y fecha (frágil).

## R4. Concurrencia con la sincronización

- **Decision**: dentro de la transacción, antes de escribir, tomar el mismo lock exclusivo que el PUSH: `pg_advisory_xact_lock(1398361667, <clave del usuario>)`. El primer número es `0x53594E43` ("SYNC"). La clave son los 4 primeros bytes del UUID del usuario, como int32 con signo. Se calcula en SQL: `('x' || substr(replace(user_id::text, '-', ''), 1, 8))::bit(32)::int`.
- **Rationale**: `apps/api/app/modules/sync/core/lock.py` exige que todo proceso que escriba datos de finanzas tome este lock en modo exclusivo. Así ningún PULL concurrente entrega un cursor que deje atrás registros de la migración (FR-019 de la spec 004).
- **Alternatives considered**: pedir que nadie use la app durante la migración. Es una buena práctica que se mantiene en el quickstart, pero no basta como garantía.

## R5. Atomicidad y modo simulación

- **Decision**: una sola transacción (`BEGIN … COMMIT`). El modo por defecto es **simulación**: ejecuta exactamente lo mismo y termina con `ROLLBACK`. Para escribir hay que pasar `--apply`. Antes de confirmar, el script recalcula en la base el saldo de cada cuenta, contando solo los movimientos con IDs de la migración, y lo compara al centavo con lo esperado del dump. Si no coincide, hace `ROLLBACK` y sale con error.
- **Rationale**: cumple FR-010 y FR-011. La simulación informa con exactitud cuántos registros se insertarían y cuántos ya existen, porque pasa por las mismas restricciones de la base. Que la opción segura sea la de por defecto evita escribir por accidente.
- **Alternatives considered**: una simulación sin conexión. Se ofrece igualmente con `--offline`: solo parsea y planifica, útil para revisar el resumen sin acceso a la base.

## R6. Cuentas: creación, reutilización y archivado

- **Decision**: por cada cuenta del mapa se busca una cuenta del usuario no borrada con el mismo nombre, sin distinguir mayúsculas.
  - **Más de una coincidencia**: se aborta.
  - **Una coincidencia**: se reutiliza. Si su moneda no es COP, se aborta. Si debe quedar archivada y no lo está, se actualiza `is_archived = true` con `updated_at = now()`; `server_updated_at` lo pone `clock_timestamp()`, para que el cambio llegue en el PULL.
  - **Ninguna**: se inserta con el ID determinista de R3.

  Valores de las cuentas nuevas:
  - `nature = 'ASSET'`, `currency = 'COP'` y `opening_balance = 0`.
  - `sort_order` 0–4, en el orden del mapa.
  - `icon` y `color` NULL.
- **Rationale**: es lo que dice FR-008. Si las cuentas se crearon antes en la app y ya se sincronizaron, no se duplican.
- **Alternatives considered**: abortar si ya existe una cuenta con ese nombre (impide re-ejecutar); reutilizar sin archivar (incumple FR-008).

## R7. Fechas

- **Decision**: `occurred_at = <movementDate>T00:00:00-05:00`, guardado en UTC como `<fecha>T05:00:00Z`. Colombia no tiene horario de verano. `created_at` y `updated_at` toman `now()`, la hora de inicio de la transacción, igual para todos los registros. `server_updated_at` toma su valor por defecto, `clock_timestamp()`.
- **Rationale**: es el supuesto de la spec. La app muestra la fecha local correcta, y si el usuario edita un movimiento en el dispositivo, su `updated_at` será posterior y ganará en LWW.
- **Alternatives considered**: mediodía local (evita errores de zona, pero cambia la hora visible sin necesidad); fecha UTC a medianoche (en Colombia se vería como el día anterior).

## R8. Validaciones y abortos

Cada uno de estos casos aborta la ejecución sin escribir. El mensaje indica la causa y, si aplica, el id de origen.
- Una línea `INSERT INTO movements` que no encaja en el formato esperado.
- Un movimiento incluido con fecha inválida (`0000-00-00` o una fecha imposible).
- Una ubicación desconocida, que no está ni en el mapa ni en la lista de excluidas.
- Que no haya exactamente un usuario en `users`.
- Cuentas ambiguas (más de una con el mismo nombre) o en una moneda distinta de COP.
- Saldos que no coinciden tras insertar (R5).
- Que no cuadre la identidad `incluidos = 2·transferencias + 2·descartados + sueltos`.

Los montos cero se **excluyen** y se informan, no abortan (spec, casos límite).

## R9. Precisión monetaria

- **Decision**: los montos viajan como **string** desde el dump hasta PostgreSQL (`$n::numeric`). Para los totales y la verificación, el script los convierte a centavos `BigInt` con un parser propio (`"-133000.00"` → `-13300000n`) y nunca usa `Number`. Los saldos que lee de la base los pide como texto (`::text`) y los convierte igual.
- **Rationale**: Principio IV de la constitución. El driver `pg` ya devuelve `NUMERIC` como string por defecto, sin pérdida.
- **Alternatives considered**: `decimal.js` (dependencia innecesaria: solo hacen falta sumas y restas de valores con 2 decimales).

## R10. Pila del script

- **Decision**:
  - Node.js 24 LTS con módulos ES (`.mjs`), el instalado.
  - Dependencias: `pg` 8.x (cliente PostgreSQL) y `uuid` 11.x (v5).
  - Pruebas con `node:test` y `node:assert`, sin framework.
  - Conexión desde `MIGRATION_DATABASE_URL` o, si no está, `DATABASE_URL`. Si la URL tiene el prefijo `postgresql+asyncpg://` del `.env` de la API, se normaliza a `postgresql://`.
  - Variables de entorno cargadas con `node --env-file` cuando el operador lo quiera.
- **Rationale**: el usuario pidió JavaScript y algo sencillo. Son dos dependencias pequeñas y estándar, sin transpilación.
- **Alternatives considered**: TypeScript (añade una etapa de compilación a un script de un solo uso); script Python dentro de `apps/api` (reutilizaría modelos, pero el usuario pidió JavaScript).

## R11. Rendimiento

- **Decision**: insertar todos los movimientos en **una sola sentencia** `INSERT … SELECT FROM unnest($1::uuid[], $2::uuid[], …)` (unos 1.922 registros) y las cuentas una por una (5).
- **Rationale**: la base de producción se alcanza por un túnel o una red remota. Con unos 50 ms de latencia, 1.922 sentencias tardarían más de 90 s; con `unnest` es un solo viaje, y así se cumple SC-004 (menos de 1 minuto).
- **Alternatives considered**: `INSERT` con muchas filas por lotes (también vale, pero obliga a generar placeholders); `COPY` (no admite `ON CONFLICT`).

## R12. Ejecución en producción

- **Decision**: el compose de Coolify no publica el puerto de PostgreSQL. En producción, el script se ejecuta en un contenedor `node:24-alpine` efímero conectado a la red del compose (`docker run --rm --network <red> -v ./migration:/work …`), con la URL interna (`db:5432`). En desarrollo se conecta a `localhost:5433` (override). Antes de `--apply` en producción, se hace un `pg_dump` manual de respaldo.
- **Rationale**: no hay que exponer la base, y se reutiliza el procedimiento de backups ya previsto.
- **Alternatives considered**: publicar temporalmente el puerto (riesgo de exposición); túnel SSH al contenedor (válido, se menciona como alternativa).
