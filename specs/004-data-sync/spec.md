# Feature Specification: Sincronización de datos de finanzas (PUSH/PULL)

**Feature Branch**: `004-data-sync`

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "quiero que empieces los endpoints correspondientes a la sincronización de datos de todas las tablas, para ello, quiero que tomes en cuenta @docs/db-finanzas.md para crear la estructura de la base de datos más los endpoints necesarios. Creo que en models ya estan creadas las estructuras de datos, ahora necesitaría implementar los endpoints para sincronizar los datos"

**Documentos de referencia**: [`CLAUDE.md`](../../CLAUDE.md), [`docs/db-finanzas.md`](../../docs/db-finanzas.md), [`docs/modulo-finanzas.md`](../../docs/modulo-finanzas.md) y la spec [`003-backend-jwt-auth`](../003-backend-jwt-auth/spec.md).

## Contexto

La spec 003 dejó creada la estructura de datos del servidor para las ocho tablas de finanzas, con propietario por usuario, columnas de sincronización y referencias entre tablas restringidas al mismo usuario. Lo que falta es la vía para que la app intercambie esos datos con el servidor.

La app es offline-first: la interfaz siempre lee y escribe en su base local y **nunca** consulta al servidor para mostrar datos. Por eso esta feature **no** crea operaciones de lectura y escritura por entidad. La sincronización es la única vía por la que los datos de finanzas entran al servidor y salen de él. Consta de dos operaciones genéricas para todas las tablas:

- **PUSH**: la app envía los registros que cambió localmente.
- **PULL**: la app recibe los registros que cambiaron en el servidor desde su último sync.

**Tablas sincronizables** (todas las de datos de `docs/db-finanzas.md`): `accounts`, `categories`, `reimbursement_groups`, `subscriptions`, `recurring_incomes`, `cdts`, `assets` y `transactions`.

## Clarifications

### Session 2026-10-18

- Q: Si un PUSH trae registros inválidos mezclados con válidos, ¿se aplican los válidos o se rechaza el lote completo? → A: Resultado por registro: se aplican los válidos y se rechazan solo los inválidos y los que dependen de ellos (no todo o nada).
- Q: Si llega un `updated_at` más de 24 h por delante de la hora del servidor, ¿se rechaza o se acepta ajustando la fecha? → A: Se rechaza el registro con motivo "reloj del dispositivo adelantado"; no se ajusta ni se acepta tal cual.
- Q: ¿El servidor valida la coherencia entre registros relacionados, además de las restricciones de la base de datos? → A: Sí, valida reglas de coherencia entre registros (ver FR-009a).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Subir los cambios hechos en el dispositivo (Priority: P1)

El usuario registra gastos, crea cuentas o edita categorías en el teléfono, incluso sin conexión. Cuando hay red, la app envía al servidor todos esos cambios pendientes en una sola operación. El servidor los guarda a nombre del usuario y responde, registro por registro, cuáles quedaron aplicados, para que la app pueda marcarlos como sincronizados.

**Why this priority**: sin PUSH, los datos del usuario existen solo en el teléfono y se pierden si lo cambia o lo pierde. Es el primer paso del orden PUSH → PULL.

**Independent Test**: con un usuario autenticado, enviar un lote con una cuenta nueva y una transacción que la referencia. Comprobar que ambas quedan guardadas para ese usuario, que la respuesta las marca como aplicadas y que reenviar el mismo lote no crea duplicados.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado sin datos en el servidor, **When** envía una cuenta y una transacción nuevas que la referencian en el mismo lote, **Then** ambas quedan guardadas a su nombre y la respuesta indica "aplicado" para cada una.
2. **Given** un registro ya guardado, **When** el usuario envía una versión con `updated_at` más reciente, **Then** el servidor la sobrescribe y lo informa como "aplicado".
3. **Given** un registro ya guardado, **When** llega una versión con `updated_at` igual o anterior al almacenado, **Then** el servidor conserva su versión y lo informa como "descartado por versión más reciente en el servidor".
4. **Given** un lote ya aplicado, **When** la app lo reenvía idéntico (reintento tras corte de red), **Then** el resultado final en el servidor es el mismo y no hay duplicados.
5. **Given** un registro con datos inválidos (p. ej. monto ≤ 0 o transferencia sin cuenta destino), **When** se envía junto a otros válidos, **Then** solo ese registro se rechaza con un motivo comprensible y los demás se aplican.
6. **Given** un registro que el usuario borró en el dispositivo, **When** se envía con `deleted_at`, **Then** el servidor lo marca como borrado lógico sin eliminarlo físicamente.

---

### User Story 2 - Recibir los cambios del servidor (Priority: P1)

Después del PUSH, la app pide los cambios ocurridos en el servidor desde su último sync exitoso de cada tabla. Así recibe lo que el usuario hizo en otro dispositivo, las versiones que ganaron un conflicto y los borrados lógicos. En el primer sync recibe todos sus datos, incluido el set inicial de categorías.

**Why this priority**: sin PULL no hay multi-dispositivo ni reinstalación, y la app no recibiría las categorías iniciales. Junto con la historia 1 forma el ciclo mínimo de sincronización.

**Independent Test**: con datos ya guardados para un usuario, pedir los cambios sin cursor y comprobar que llegan todos sus registros, sin los de otros usuarios. Después pedir con el cursor devuelto y comprobar que no llega nada si no hubo cambios.

**Acceptance Scenarios**:

1. **Given** un usuario recién creado, **When** la app pide cambios por primera vez (sin cursor), **Then** recibe sus 15 categorías iniciales y un cursor por cada tabla.
2. **Given** una app con cursor de la sincronización anterior, **When** pide cambios, **Then** recibe solo los registros modificados en el servidor después de ese cursor, incluidos los borrados lógicos.
3. **Given** dos usuarios con datos, **When** uno pide cambios, **Then** nunca recibe registros del otro, y la respuesta no incluye el identificador de usuario.
4. **Given** más cambios de los que caben en una respuesta, **When** la app pide cambios, **Then** recibe una página, un cursor para continuar y una indicación de que hay más. Al seguir pidiendo con ese cursor recibe el resto sin perder ni repetir registros.
5. **Given** que la app pide cambios mientras otro dispositivo del mismo usuario está subiendo los suyos, **When** ambas operaciones terminan, **Then** ningún cambio confirmado queda fuera de futuros PULL.

---

### User Story 3 - Uso desde varios dispositivos sin perder datos (Priority: P2)

El usuario usa la app en el teléfono y en la web. Edita la misma cuenta en ambos sin conexión y luego los dos sincronizan. Al final, ambos dispositivos muestran la misma versión: la editada más recientemente (last-write-wins).

**Why this priority**: es el resultado que el usuario percibe de las historias 1 y 2 combinadas. Valida las reglas de conflicto de punta a punta.

**Independent Test**: simular dos clientes del mismo usuario que modifican el mismo registro con `updated_at` distintos. Ambos hacen PUSH y luego PULL, y al final los dos tienen la versión con `updated_at` mayor.

**Acceptance Scenarios**:

1. **Given** el dispositivo A editó un registro a las 10:00 y el B el mismo registro a las 10:05 (ambos sin conexión), **When** sincronizan en cualquier orden, **Then** los dos terminan con la versión de las 10:05.
2. **Given** el dispositivo A borró un registro y el B lo editó después, **When** ambos sincronizan, **Then** gana la operación con `updated_at` más reciente, sea el borrado o la edición.

---

### Edge Cases

- **Referencias en el mismo lote**: una transacción puede referenciar una cuenta o categoría que viene en el mismo PUSH. El servidor aplica los registros en el orden de dependencias entre tablas, sin importar cómo vengan ordenados.
- **Referencia inexistente o ajena**: si un registro referencia algo que no existe para ese usuario (ni en el servidor ni en el lote), se rechaza ese registro con motivo "referencia inválida" y no se revela si el ID pertenece a otro usuario.
- **Dependencia rechazada**: si se rechaza un registro, también se rechazan los registros del mismo lote que dependen de él, con el motivo de esa dependencia.
- **ID usado por otro usuario**: si el UUID que envía la app ya existe en el servidor a nombre de otro usuario, el registro se rechaza con un motivo genérico, sin revelar datos ajenos ni sobrescribirlos.
- **Débito de suscripción duplicado**: si dos dispositivos generan el mismo débito, ambos usan el mismo ID determinista y se trata como el mismo registro (LWW). Si llega un débito con otro ID para el mismo periodo de la misma suscripción, se rechaza por duplicado.
- **Nombre de categoría repetido**: crear una categoría con el mismo nombre y tipo que otra no borrada del usuario se rechaza con motivo "duplicado".
- **Reloj del dispositivo adelantado**: un `updated_at` demasiado en el futuro ganaría todos los conflictos para siempre. Se rechazan los registros con `updated_at` más de 24 horas posterior a la hora del servidor.
- **Borrado de un registro referenciado**: el borrado es lógico, así que una cuenta borrada sigue existiendo para las transacciones que la referencian. Se acepta y no rompe referencias.
- **Tabla desconocida o campo no permitido**: los nombres de tabla fuera de la lista se rechazan. Los campos que solo existen en el servidor (propietario, `server_updated_at`) o solo en el cliente (`is_dirty`) se ignoran si la app los envía.
- **Lote demasiado grande**: un PUSH que supera el máximo de registros se rechaza completo, con un error claro, para que la app lo divida.
- **Sesión expirada a mitad de sync**: sin sesión válida no se aplica nada. La app renueva su sesión y reintenta, y como las operaciones son idempotentes el reintento es seguro.
- **Montos con más de 2 decimales o en formato no exacto**: se rechaza el registro. Nunca se redondea en silencio.

## Requirements *(mandatory)*

### Functional Requirements

**Generales**

- **FR-001**: El sistema MUST ofrecer dos operaciones de sincronización, PUSH y PULL, que cubran las ocho tablas sincronizables en una sola llamada cada una. Agregar una tabla nueva en el futuro MUST NOT requerir operaciones nuevas, solo registrarla en la sincronización.
- **FR-002**: Ambas operaciones MUST exigir una sesión válida y actuar siempre sobre el usuario de la sesión. El sistema MUST NOT aceptar un identificador de usuario enviado por la app ni devolverlo en las respuestas.
- **FR-003**: Esta feature MUST NOT crear operaciones de lectura o escritura por entidad para las tablas sincronizables.
- **FR-004**: Los montos MUST viajar como texto decimal exacto (p. ej. `"1234.56"`), con un máximo de 2 decimales (4 en las tasas de CDT y 2 en la retención), y MUST NOT convertirse a punto flotante en ningún paso. Las fechas y horas MUST viajar en UTC en formato ISO-8601 y las fechas sin hora como `YYYY-MM-DD`.

**PUSH**

- **FR-005**: El PUSH MUST recibir, agrupados por tabla, los registros completos que cambiaron en el dispositivo, cada uno con su ID generado en el cliente, `created_at`, `updated_at` y `deleted_at`.
- **FR-006**: Para cada registro, el sistema MUST aplicar last-write-wins. Si no existe, lo crea. Si existe y el `updated_at` entrante es **estrictamente** más reciente, lo sobrescribe. En otro caso conserva la versión del servidor.
- **FR-007**: Cada vez que el sistema crea o sobrescribe un registro, MUST asignarle una nueva marca del servidor (`server_updated_at`) que lo haga visible en los PULL posteriores. Un registro descartado por LWW MUST NOT cambiar su marca.
- **FR-008**: La respuesta del PUSH MUST informar el resultado de **cada** registro recibido: `aplicado`, `descartado` (el servidor tiene una versión igual o más reciente) o `rechazado` (con un código y un mensaje legible del motivo). La app usa `aplicado` y `descartado` para dejar de marcar el registro como pendiente. En el caso `descartado`, la versión ganadora le llega en el PULL siguiente.
- **FR-009**: El sistema MUST validar cada registro con las mismas reglas de negocio que la estructura de datos de `docs/db-finanzas.md` (valores permitidos, montos positivos, transferencias con destino distinto del origen, campos obligatorios por ciclo, etc.) y rechazar solo los registros inválidos (y, según FR-011, los que dependen de ellos), sin abortar el resto del lote. El PUSH MUST NOT funcionar como todo o nada, ni a nivel de lote ni de tabla.
- **FR-009a**: Además, el sistema MUST validar la coherencia de cada registro con los registros que referencia, tomando su versión vigente en el servidor o en el mismo lote. Si no se cumple, rechaza el registro con motivo "incoherente":
  - `transactions`: una `EXPENSE` solo usa categorías `EXPENSE`; una `INCOME`, solo categorías `INCOME`; una `TRANSFER` no lleva categoría. Si tiene `subscription_id` MUST ser `EXPENSE`.
  - `subscriptions`: la categoría, si existe, MUST ser `EXPENSE`.
  - `recurring_incomes`: la categoría, si existe, MUST ser `INCOME`.
  - `accounts`: la cuenta padre MUST existir, ser distinta de la propia cuenta y no tener padre (un solo nivel). Una cuenta que ya tiene subcuentas no puede convertirse en subcuenta. `CREDIT_CARD` ⇒ `nature = LIABILITY`.
  - `cdts`: `account_id` MUST referenciar una cuenta `INVESTMENT`, y `source_account_id` MUST ser distinta de esa cuenta.
  - Las reglas se evalúan al recibir el registro. Cambiar después un registro referenciado (p. ej. el tipo de una categoría) MUST NOT invalidar ni rechazar retroactivamente los registros ya guardados que lo usan.
- **FR-010**: El sistema MUST aplicar los registros de un lote en el orden de dependencias entre tablas, de modo que un registro pueda referenciar otro que llega en el mismo lote. También MUST resolver las referencias entre registros de una misma tabla: subcuentas → cuenta padre y CDT renovado → CDT anterior.
- **FR-011**: Un registro cuyas referencias no existen para el usuario MUST rechazarse, sin revelar si el ID existe para otro usuario. Los registros del lote que dependan de un registro rechazado MUST rechazarse también.
- **FR-012**: El PUSH MUST ser idempotente: reenviar el mismo lote produce el mismo estado final, sin duplicados, y responde `aplicado` o `descartado` para los registros que ya estaban.
- **FR-013**: El sistema MUST rechazar registros con `updated_at` más de 24 horas posterior a la hora del servidor, con un código de motivo específico ("reloj del dispositivo adelantado") que la app pueda distinguir para pedir al usuario que revise la fecha de su dispositivo. El sistema MUST NOT ajustar la fecha en silencio.
- **FR-014**: El sistema MUST limitar el tamaño de un PUSH a un máximo de 500 registros y rechazar completo el lote que lo supere, con un error que lo indique.
- **FR-015**: Los borrados MUST ser lógicos: un registro con `deleted_at` se conserva en el servidor y se propaga en el PULL. Restaurar un registro (versión más reciente con `deleted_at` vacío) MUST estar permitido.

**PULL**

- **FR-016**: El PULL MUST recibir, opcionalmente, un cursor por tabla. Para cada tabla, MUST devolver los registros del usuario con marca del servidor posterior a ese cursor, incluidos los borrados lógicos, junto con un nuevo cursor. Sin cursor, devuelve todos los registros del usuario en esa tabla (primer sync).
- **FR-017**: Los cursores MUST basarse exclusivamente en la marca asignada por el servidor, nunca en el reloj del dispositivo.
- **FR-018**: El PULL MUST paginar con un máximo de registros por respuesta. Cuando hay más cambios, MUST indicarlo y devolver un cursor que permita continuar sin omitir ni repetir registros, incluso si varios registros comparten la misma marca.
- **FR-019**: El sistema MUST garantizar que un cambio confirmado nunca quede detrás de un cursor ya entregado. Una escritura concurrente que se confirma después de un PULL MUST aparecer en algún PULL posterior.
- **FR-020**: Los registros del PULL MUST tener el mismo formato que los del PUSH, sin el propietario. Así la app los aplica tal cual a su base local, incluyendo la marca del servidor para que la app calcule su cursor.

**Integración con lo existente**

- **FR-021**: El set inicial de categorías creado al registrar un usuario (spec 003, FR-016) MUST llegar a la app en su primer PULL como registros normales.
- **FR-022**: La operación existente de listar categorías puede mantenerse como apoyo de depuración, pero la app MUST NOT depender de ella: su fuente de datos es el PULL.

### Key Entities

- **Registro sincronizable**: cualquier fila de las ocho tablas de finanzas. Tiene ID generado en el cliente, `created_at`, `updated_at` (reloj del dispositivo que editó, usado para LWW), `deleted_at` (borrado lógico) y la marca del servidor (cursor del PULL). El propietario lo asigna el servidor.
- **Lote de PUSH**: conjunto de registros cambiados, agrupados por tabla, enviados en una operación.
- **Resultado por registro**: tabla + ID + estado (`aplicado` / `descartado` / `rechazado`) + motivo si se rechazó.
- **Cursor de tabla**: posición opaca en la secuencia de cambios del servidor para una tabla. La app lo guarda en su `sync_metadata` tras un sync exitoso y lo devuelve en el PULL siguiente.
- **Orden de dependencias**: `categories`, `reimbursement_groups`, `assets` → `accounts` (padres antes que subcuentas) → `subscriptions`, `recurring_incomes`, `cdts` (anteriores antes que renovaciones) → `transactions`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario que hace cambios en un dispositivo sin conexión los ve en un segundo dispositivo tras un ciclo PUSH + PULL en cada uno, sin pérdidas, en el 100 % de los escenarios de prueba.
- **SC-002**: Reenviar cualquier lote de PUSH entre 1 y 5 veces deja exactamente el mismo estado en el servidor (0 duplicados).
- **SC-003**: Ningún usuario recibe, modifica ni puede inferir datos de otro usuario en ninguna prueba de aislamiento, incluidos IDs ajenos enviados deliberadamente.
- **SC-004**: En pruebas de concurrencia (PUSH de un dispositivo simultáneo con PULL de otro), el 100 % de los cambios confirmados llega en algún PULL posterior.
- **SC-005**: Un ciclo de sincronización de un uso típico (hasta 200 registros cambiados) termina en menos de 3 segundos con una conexión móvil normal.
- **SC-006**: El primer sync de un usuario con un año de datos (≈ 5.000 transacciones) completa la descarga sin errores, paginado.
- **SC-007**: Ningún monto cambia de valor en el viaje de ida y vuelta (PUSH → servidor → PULL), verificado con valores que fallan en punto flotante (p. ej. `0.10 + 0.20`).

## Assumptions

- La estructura de datos y las migraciones de las ocho tablas ya existen (spec 003) y se reutilizan. Solo se modifican si el plan detecta algo imprescindible para la sincronización, por ejemplo para garantizar FR-019.
- La implementación del lado de la app (base local, `is_dirty`, `sync_metadata`, disparo del sync) queda **fuera de alcance**. Será una spec posterior del cliente.
- Solo COP en el MVP: la moneda vive en la cuenta y las transacciones la heredan, como indica `docs/db-finanzas.md`.
- Validación por registro con resultado individual: un registro inválido no bloquea al resto del lote, salvo los que dependen de él.
- El límite de 500 registros por PUSH, el tamaño de página del PULL y la tolerancia de 24 h de reloj adelantado son valores iniciales razonables y pueden ajustarse en el plan.
- La generación automática de débitos de suscripciones en el servidor queda fuera de alcance. Esta feature solo acepta y propaga los que genera la app, respetando su ID determinista.
- No hay borrado físico vía sync. La purga de registros borrados lógicamente, si algún día se necesita, será otra feature.
