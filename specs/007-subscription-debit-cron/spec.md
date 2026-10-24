# Feature Specification: Débito automático diario de suscripciones

**Feature Branch**: `007-subscription-debit-cron`

**Created**: 2026-10-24

**Status**: Draft

**Input**: User description: "Basado en la tabla de suscripciones @apps/api/app/db/models/subscriptions.py que se encuentra en la base de datos, crea un nuevo contenedor de docker y un microservicio encargado de cron job, lo que debe realizar es verificar todos los días si hay una suscripción que se debe cobrar hoy, y automáticamente registrar el egreso. El microservicio puede ser en python, y se podrá conectar directamente a la base de datos para no tener que hacer ninguna transaction adicional por API."

**Documentos de referencia**: [`docs/modulo-finanzas.md`](../../docs/modulo-finanzas.md) (§4 Suscripciones) y [`docs/db-finanzas.md`](../../docs/db-finanzas.md) (§3 `transactions`, §5 `subscriptions`).

## Resumen

Hoy las suscripciones solo se registran: nadie genera sus cobros (spec 004 y 006 lo dejaron fuera de alcance). Esta feature añade un **proceso programado en el servidor** que, una vez al día, revisa las suscripciones activas de todos los usuarios y, para cada una cuyo cobro cae hoy, **registra el egreso** en la cuenta asociada. El egreso llega a la app en el siguiente sync, como cualquier otro movimiento.

El proceso corre como un **servicio independiente** de la API, desplegado junto a ella, que escribe directamente en la base de datos del servidor.

### Alcance

**Incluido**

- Ejecución diaria automática y posibilidad de ejecutarlo a mano (para pruebas y recuperación).
- Cálculo de la fecha de cobro del periodo actual según periodicidad, día y mes de cobro, y fecha de inicio.
- Registro del egreso con ID determinista por (suscripción, periodo), de forma atómica e idempotente.
- Coordinación con la sincronización para que ningún débito generado se pierda en el PULL de la app.
- Despliegue como servicio adicional en la misma composición que la API y la base de datos.
- Registro (log) del resultado de cada ejecución.

**Fuera de alcance**

- Generación de débitos en el dispositivo (al abrir la app sin conexión): llegará en otra spec, usando el mismo ID determinista.
- Notificaciones al usuario (push o correo) sobre cobros realizados o próximos, y alertas al administrador cuando una ejecución falla.
- Detectar que el usuario ya registró a mano el mismo cobro sin vincularlo a la suscripción.
- Zona horaria por usuario.
- Periodicidades distintas de mensual y anual.

## Clarifications

### Session 2026-10-24

- Q: Si el servicio no corrió un día (caída, despliegue) o una suscripción tiene fecha de inicio antigua, ¿qué periodos se cobran? → A: Solo el periodo actual (mes en mensuales, año en anuales), si su fecha de cobro es hoy o ya pasó. Los periodos anteriores no se recuperan.
- Q: En la primera activación, ¿se registran los cobros del periodo actual cuya fecha ya pasó? → A: No. Hay una fecha de activación configurable y nunca se registra un cobro con fecha de cobro anterior a ella; desde ahí rige la regla del periodo actual.
- Q: Si un cobro se registra tarde (p. ej. el del 15 se registra el 17), ¿qué fecha lleva el movimiento? → A: La fecha de cobro del periodo (el 15), no la del día en que se registró.
- Q: Si la cuenta de una suscripción activa está archivada, ¿se registra su cobro? → A: Sí, normal; archivar solo oculta la cuenta. Para dejar de cobrar se pausa o cancela la suscripción.
- Q: ¿Cómo se detecta que la ejecución diaria falló o no corrió? → A: Solo con el log del resumen de cada ejecución; el healthcheck indica únicamente que el proceso está vivo. Sin alertas ni notificaciones.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El cobro de una suscripción se registra solo el día que corresponde (Priority: P1)

Como usuario, tengo una suscripción mensual a Netflix por 44.900 COP que se cobra el día 15 en mi tarjeta. El día 15, sin que yo haga nada, aparece un egreso de 44.900 COP en esa tarjeta, con la categoría de la suscripción y su nombre como descripción. Al sincronizar la app lo veo en mis movimientos y el saldo de la tarjeta lo refleja.

**Why this priority**: es el valor central de la feature: dejar de registrar a mano los gastos fijos.

**Independent Test**: crear una suscripción activa cuyo cobro cae hoy, ejecutar el proceso y verificar que existe exactamente un egreso con el monto, la cuenta, la categoría y el periodo correctos, y que el siguiente PULL de la app lo entrega.

**Acceptance Scenarios**:

1. **Given** una suscripción `ACTIVE` mensual con día de cobro 15 y hoy es 15, **When** corre el proceso diario, **Then** se registra un egreso por el monto de la suscripción, en su cuenta, con su categoría, descripción igual al nombre de la suscripción, fecha del movimiento igual a hoy y periodo `YYYY-MM` del mes actual.
2. **Given** una suscripción `ACTIVE` anual con día 10 y mes 3, **When** el proceso corre el 10 de marzo, **Then** se registra un egreso con periodo `YYYY` del año actual; **When** corre cualquier otro día del año, **Then** no se registra nada para ella.
3. **Given** una suscripción mensual con día de cobro 31, **When** el proceso corre el último día de un mes de 30 días (o de febrero), **Then** se registra el cobro de ese mes ese día.
4. **Given** un egreso recién generado, **When** la app del usuario sincroniza, **Then** lo recibe en el PULL y lo muestra como un movimiento más, vinculado a la suscripción.
5. **Given** varios usuarios con suscripciones que se cobran hoy, **When** corre el proceso, **Then** cada egreso queda registrado a nombre de su dueño y en una cuenta de ese mismo usuario.

---

### User Story 2 - Nunca se cobra dos veces el mismo periodo (Priority: P1)

Como usuario, quiero la certeza de que un mismo cobro no aparece duplicado aunque el proceso se ejecute varias veces el mismo día, se reintente tras un fallo o (en el futuro) la app genere el mismo débito.

**Why this priority**: un cobro duplicado descuadra el saldo y destruye la confianza en la app; vale tanto como generar el cobro.

**Independent Test**: ejecutar el proceso dos veces seguidas el mismo día y verificar que solo existe un egreso por suscripción y periodo, y que la segunda ejecución reporta cero cobros nuevos.

**Acceptance Scenarios**:

1. **Given** el cobro del periodo actual ya está registrado, **When** el proceso vuelve a correr, **Then** no crea otro ni modifica el existente.
2. **Given** el usuario borró (borrado lógico) el egreso generado de este periodo, **When** el proceso vuelve a correr, **Then** no lo recrea ni lo restaura.
3. **Given** el usuario editó el egreso generado (p. ej. cambió el monto porque hubo un ajuste), **When** el proceso vuelve a correr, **Then** respeta la edición.
4. **Given** el proceso falla a mitad de una ejecución, **When** se reintenta, **Then** termina los cobros pendientes sin duplicar los ya registrados.
5. **Given** dos ejecuciones simultáneas (p. ej. una programada y una manual), **When** ambas procesan la misma suscripción, **Then** queda un solo egreso.

---

### User Story 3 - Solo se cobran las suscripciones vigentes (Priority: P2)

Como usuario, si pauso, cancelo o elimino una suscripción, o si su fecha de inicio aún no llega, no quiero que se me registre su cobro.

**Why this priority**: evita egresos falsos, pero depende de que exista el cobro básico (US1).

**Independent Test**: preparar suscripciones `PAUSED`, `CANCELLED`, borradas y con `start_date` futura cuyo día de cobro es hoy; ejecutar el proceso y verificar que ninguna genera egreso.

**Acceptance Scenarios**:

1. **Given** una suscripción `PAUSED` o `CANCELLED` cuyo día de cobro es hoy, **When** corre el proceso, **Then** no se registra cobro.
2. **Given** una suscripción con borrado lógico, **When** corre el proceso, **Then** no se registra cobro.
3. **Given** una suscripción `ACTIVE` cuya fecha de inicio es posterior a la fecha de cobro de este periodo, **When** corre el proceso, **Then** no se registra cobro en este periodo.
4. **Given** una suscripción `ACTIVE` cuya cuenta fue eliminada, **When** corre el proceso, **Then** no se registra cobro, queda constancia en el registro de la ejecución y el resto de suscripciones se procesa normalmente.

---

### User Story 4 - Operar y vigilar el servicio (Priority: P3)

Como administrador del despliegue, quiero que el servicio se despliegue junto a la API sin pasos manuales, que pueda saber si corrió y qué hizo, y que pueda lanzarlo a mano para un día concreto si algo falló.

**Why this priority**: necesario para producción, pero no aporta valor visible al usuario por sí solo.

**Independent Test**: desplegar la composición completa, verificar que el servicio aparece sano, lanzar una ejecución manual y leer en su registro el resumen (suscripciones revisadas, cobros creados, omitidos y errores).

**Acceptance Scenarios**:

1. **Given** el despliegue de la composición, **When** arranca, **Then** el servicio de cobros arranca solo, espera a que la base de datos esté disponible y queda programado para la ejecución diaria.
2. **Given** una ejecución terminada, **When** el administrador revisa el registro, **Then** ve fecha procesada, número de suscripciones revisadas, cobros creados, omitidos (ya existentes) y errores, sin montos ni datos personales más allá de identificadores.
3. **Given** el administrador lanza una ejecución manual, **When** termina, **Then** el resultado es el mismo que el de la ejecución programada para esa fecha.
4. **Given** el servicio no puede conectarse a la base de datos, **When** llega la hora de ejecutar, **Then** registra el error, reintenta y no deja cobros a medias.

---

### Edge Cases

- **Día 29, 30 o 31 en meses cortos**: se cobra el último día del mes (misma regla de `docs/db-finanzas.md`). Anual el 29 de febrero en año no bisiesto: se cobra el 28.
- **Suscripción editada después del cobro** (monto, cuenta o categoría): el egreso ya registrado no cambia; la edición aplica a periodos futuros.
- **Cambio de día de cobro dentro del periodo**: si el periodo actual ya tiene cobro, no se genera otro; si no lo tiene y la nueva fecha es hoy o ya pasó, se cobra en la siguiente ejecución.
- **Suscripción reanudada** (`PAUSED` → `ACTIVE`): no se cobran los periodos anteriores en los que estuvo pausada; si la fecha de cobro del periodo actual ya pasó y no tiene cobro, se cobra en la siguiente ejecución.
- **Servicio caído varios días**: al volver, cobra lo pendiente del periodo actual, con la fecha de cobro original como fecha del movimiento (FR-008). Si la caída cubrió un periodo completo (p. ej. un mes entero), ese periodo no se cobra solo y el usuario lo registra a mano si hace falta.
- **Primera activación del servicio**: no genera cobros con fecha anterior a la fecha de activación (FR-007a), aunque `start_date` sea antigua o el periodo actual tenga cobros ya vencidos. Ejemplo: activado el 24 de octubre, una mensual con día 15 empieza a cobrarse el 15 de noviembre, y una con día 28 se cobra el 28 de octubre.
- **Suscripción creada después de su fecha de cobro del mes** (p. ej. el 20, con día de cobro 15 e inicio hoy): no se cobra este periodo porque la fecha de cobro es anterior a `start_date` (FR-006); el primer cobro es el del siguiente periodo.
- **Cuenta archivada**: el cobro se registra igual; archivar solo oculta la cuenta en la app.
- **Categoría eliminada**: el egreso se registra sin categoría (pendiente de clasificar) en lugar de fallar.
- **Categoría que no es de gasto**: igual que la anterior, el egreso queda sin categoría; no se registra un egreso con categoría de ingreso.
- **Cambio de día cerca de medianoche**: "hoy" se evalúa siempre en la zona horaria de referencia del servicio, no en UTC, para que un cobro del día 15 no se registre el 14 por la noche ni el 16.
- **Sincronización en curso**: si el usuario está sincronizando mientras se generan sus cobros, ninguno se pierde: o lo recibe en ese PULL o en el siguiente.
- **Usuario eliminado durante la ejecución**: sus suscripciones dejan de procesarse; no es un error de la ejecución.
- **Error en una suscripción** (datos inválidos, restricción violada): se registra, se omite esa suscripción y la ejecución continúa con las demás.
- **El dispositivo también genera el débito** (feature futura): ambos usan el mismo ID determinista y el mismo periodo, así que al sincronizar es el mismo registro.

## Requirements *(mandatory)*

### Functional Requirements

**Programación y ejecución**

- **FR-001**: El sistema MUST ejecutar el proceso de cobros automáticamente una vez al día, a una hora configurable, evaluando "hoy" en una zona horaria de referencia configurable.
- **FR-002**: El sistema MUST permitir ejecutar el proceso a mano, opcionalmente para una fecha concreta, con el mismo resultado que la ejecución programada para esa fecha.
- **FR-003**: El proceso MUST revisar las suscripciones de **todos** los usuarios en cada ejecución.

**Selección de suscripciones y periodo**

- **FR-004**: Solo MUST generar cobro para suscripciones con estado `ACTIVE`, sin borrado lógico y cuyo dueño exista.
- **FR-005**: El periodo MUST ser `YYYY-MM` para mensuales y `YYYY` para anuales, y la fecha de cobro del periodo MUST calcularse con el día de cobro (y el mes, si es anual), usando el último día del mes cuando el día no existe en ese mes.
- **FR-006**: MUST NOT generarse cobro para un periodo cuya fecha de cobro sea anterior a la fecha de inicio de la suscripción.
- **FR-007**: El proceso MUST evaluar solo el **periodo actual** de cada suscripción (mes en curso en mensuales, año en curso en anuales) y generar su cobro si la fecha de cobro es hoy o ya pasó y aún no existe. MUST NOT generar cobros de periodos anteriores, aunque falten.
- **FR-007a**: El servicio MUST tener una **fecha de activación** configurable. MUST NOT generar un cobro cuya fecha de cobro sea anterior a ella, ni siquiera en una ejecución manual para una fecha pasada (FR-002). Si no está configurada, el servicio MUST NOT ejecutarse y MUST registrar el error, para que nunca arranque sin ese límite.

**Registro del egreso**

- **FR-008**: Cada cobro MUST registrarse como un movimiento de tipo egreso con: el monto de la suscripción (decimal exacto, nunca punto flotante), la cuenta de la suscripción, su categoría si existe y es de gasto, descripción igual al nombre de la suscripción, origen de categoría manual, fecha del movimiento igual a la fecha de cobro del periodo (también cuando se registra en un día posterior; nunca la fecha de ejecución), vínculo a la suscripción y su periodo.
- **FR-009**: El movimiento MUST pertenecer al mismo usuario que la suscripción y MUST referenciar solo cuenta y categoría de ese usuario.
- **FR-010**: El ID del movimiento MUST ser determinista a partir de (suscripción, periodo), con el esquema documentado en `docs/db-finanzas.md` §5, y el espacio de nombres usado MUST quedar fijado y documentado para que la app genere exactamente el mismo ID en el futuro.
- **FR-011**: Si la cuenta de la suscripción no existe o está borrada, MUST NOT registrarse el cobro; se registra en el log como omitido con motivo. Una cuenta **archivada** no impide el cobro: se registra normalmente.
- **FR-012**: Si la categoría no existe, está borrada o no es de gasto, el cobro MUST registrarse sin categoría.

**Idempotencia y atomicidad**

- **FR-013**: El proceso MUST ser idempotente: ejecutarlo varias veces para la misma fecha, en serie o en paralelo, MUST producir un único movimiento por (suscripción, periodo).
- **FR-014**: Si ya existe un movimiento para (suscripción, periodo), incluso borrado lógicamente o editado por el usuario, el proceso MUST NOT crearlo de nuevo, restaurarlo ni modificarlo.
- **FR-015**: Cada cobro MUST registrarse de forma atómica: o queda completo o no queda nada. El fallo de una suscripción MUST NOT impedir procesar las demás.

**Coherencia con la sincronización**

- **FR-016**: Los movimientos generados MUST quedar visibles para el PULL de la app con las mismas garantías que los subidos por PUSH: marca de servidor asignada por el servidor, fechas de creación y modificación en UTC, y sin que un PULL concurrente del mismo usuario los deje detrás de su cursor (regla del lock de sincronización por usuario del backend).
- **FR-017**: El proceso MUST NOT modificar las suscripciones ni ningún otro registro distinto del movimiento creado.

**Despliegue y operación**

- **FR-018**: El servicio MUST desplegarse como un servicio independiente dentro de la misma composición que la API y la base de datos, compatible con Coolify: configuración solo por variables de entorno, healthcheck y arranque condicionado a que la base de datos esté sana. El healthcheck MUST indicar solo que el proceso y su programación están vivos; MUST NOT depender del resultado de la última ejecución.
- **FR-019**: El servicio MUST NOT ejecutar migraciones; el esquema lo gestiona la API. Si el esquema no es el esperado, MUST registrar el error y no escribir.
- **FR-020**: Cada ejecución MUST registrar un resumen: fecha procesada, suscripciones revisadas, cobros creados, omitidos (ya existentes) y fallidos con motivo, usando identificadores y sin datos personales ni secretos.
- **FR-021**: Si la base de datos no está disponible, el servicio MUST reintentar con espera creciente dentro de una ventana limitada y registrar el fallo si no lo consigue.
- **FR-022**: La lógica de cálculo de periodos, fechas de cobro e idempotencia MUST tener pruebas automatizadas (constitución, Flujo de trabajo y calidad).

### Key Entities

- **Suscripción** (existente, `subscriptions`): gasto fijo recurrente con cuenta, categoría opcional, monto, periodicidad (mensual/anual), día y mes de cobro, fecha de inicio y estado. Es la fuente del cobro; esta feature solo la lee.
- **Movimiento** (existente, `transactions`): el egreso generado. Se identifica por un ID determinista de (suscripción, periodo) y lleva `subscription_id` y `subscription_period`, únicos en conjunto.
- **Ejecución de cobros**: una corrida del proceso para una fecha; no se persiste como entidad, solo como registro (log) con su resumen.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de las suscripciones activas cuyo cobro cae en un día tienen su egreso registrado ese mismo día, sin acción del usuario.
- **SC-002**: Cero egresos duplicados por suscripción y periodo, incluso tras 10 ejecuciones repetidas o simultáneas para la misma fecha.
- **SC-003**: Cero egresos generados para suscripciones pausadas, canceladas, eliminadas, con fecha de inicio futura o con fecha de cobro anterior a la fecha de activación del servicio.
- **SC-004**: El usuario ve el egreso en la app en su siguiente sincronización tras la ejecución, sin pasos adicionales.
- **SC-005**: La ejecución diaria termina en menos de 1 minuto con 10.000 suscripciones activas.
- **SC-006**: Tras un despliegue nuevo, el servicio queda programado y sano sin intervención manual, y el resumen de cada ejecución es consultable en los logs del despliegue.

## Assumptions

- **Zona horaria de referencia**: el MVP opera en Colombia (COP), así que "hoy" se evalúa por defecto en `America/Bogota`, configurable para todo el servicio. La zona por usuario queda fuera de alcance.
- **Fecha de activación**: se fija al desplegar el servicio por primera vez (normalmente, el día del despliegue) y no se cambia después, salvo para una recuperación deliberada.
- **Hora de ejecución**: por defecto a primera hora del día en la zona de referencia (p. ej. 00:05), configurable.
- **Moneda**: la del MVP (COP); el egreso hereda la moneda de la cuenta como cualquier otro movimiento.
- **Escritura directa**: el servicio se conecta directamente a la base de datos del servidor, como pidió el usuario, en lugar de usar la API. A cambio, MUST respetar las mismas reglas que la API: aislamiento por usuario, marca de servidor para el cursor y lock de sincronización por usuario (ver `apps/api/app/modules/sync/core/lock.py`).
- **Tecnología**: servicio en Python, en su propio contenedor, con la misma base de datos PostgreSQL. Si comparte código con `apps/api` (modelos, cálculo de periodos) o se ubica en `apps/` como servicio propio, se decide en el plan.
- **Hoy solo el servidor genera débitos**: la app (spec 006) aún no los genera; el ID determinista deja preparado que lo haga en el futuro sin duplicados.
- **Usuarios con datos migrados** (spec 005): si un cobro del periodo actual ya fue registrado a mano sin vínculo a la suscripción, el proceso no puede detectarlo y generará el suyo; el usuario puede borrar uno de los dos. Detectarlo queda fuera de alcance.
- **Sin notificaciones**: el usuario se entera del cobro al ver sus movimientos.
- **Vigilancia por logs**: el administrador detecta fallos revisando los logs del despliegue. Se acepta el riesgo de que una falla no vista durante todo un periodo haga perder sus cobros (FR-007); las alertas quedan fuera de alcance.
