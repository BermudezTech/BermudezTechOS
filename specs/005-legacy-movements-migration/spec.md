# Feature Specification: Migración de movimientos desde la base antigua

**Feature Branch**: `005-legacy-movements-migration`

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "Tenemos el archivo @migration/bermudezwebapp-17-Saturday-October-2026.sql que es el dump de la antigua base de datos que quiero migrar a la nueva. Para ello, quiero que crees un script de migración sencillo con javascript, que se encargue de conectarse a la base de datos ya establecida, y utilizando como referencia la nueva estructura de la base de datos definida en @docs/db-finanzas.md. Para que tengas en cuenta, no quiero que la migración incluya lo de los CDTs, los incluiré luego manualmente en la app, los movimientos si se deben migrar en su totalidad a excepción de aquellos cuya currency sea USD... Solo los de COP. El resto no quiero migrar nada, solo los movimientos... En los movimientos los ingresos tienen amount positivo y los egresos amount negativo. Aquellos movimientos con location id de 9 o 3 tampoco estarán incluidos. Al igual los de 4 porque son USD. Los de efectivo y bolsillo si permanecen igual, nequi también, bancolombia también, a la mano y global 66 van a estar archivados en la nueva arquitectura, pero los movimientos también deben ser transferidos"

## Contexto del origen

El dump (`migration/bermudezwebapp-17-Saturday-October-2026.sql`, 17-10-2026) es de una base antigua de un solo usuario. Las tablas relevantes son:

- **`location`** (cuentas antiguas): 1 Efectivo, 2 Nequi, 3 CDT Bancamia, 4 Paypal (USD), 5 Bancolombia, 6 A la mano, 7 Global66, 8 Bolsillo, 9 CDT Bancamia.
- **`movements`**: 2.149 filas (`id`, `description`, `amount` con signo, `movementDate` como fecha sin hora, `location`, `cdt`). Por ubicación: 1 → 496, 2 → 438, 3 → 11, 5 → 634, 6 → 2, 7 → 20, 8 → 547, 9 → 1. Ningún movimiento de esta tabla tiene ubicación 4.
- **`transfers`** (210 filas): registra transferencias entre ubicaciones, pero cada una **ya aparece en `movements`** como dos filas: una negativa en el origen ("Transferencia a X") y una positiva en el destino ("Transferencia desde Y"). Unas 431 filas de `movements` corresponden a estas patas, incluidas las transferencias hacia y desde los CDTs.
- **Pruebas sobre el dump**: emparejando por los propios movimientos (misma fecha, mismo monto con signo opuesto, cuentas distintas, descripción "Transferencia a…/desde…") salen 208 pares de 429 patas candidatas en cuentas migradas ("Transferencia adelanto por viáticos" no cuenta: la regla exige la palabra completa "a" o "desde"). 7 de esos pares son entre Efectivo y Bolsillo y 13 patas quedan sueltas: transferencias a CDT, montos que no coinciden o pares con la otra pata en otra fecha. La tabla `transfers` no sirve para emparejar: 16 de sus 210 filas no tienen las dos patas con la misma fecha y monto.
- **Fuera de alcance** (no se migran): `cdt`, `cdtmovements`, `usmovements` (USD), `currencyexchange`, `goals`, `items`, `recurring`, `transfers` (como tabla), `users`, `emailbackup`.

## Clarifications

### Session 2026-10-18

- Q: ¿A qué usuario se asignan los datos migrados? → A: Al único usuario que existe hoy en la base nueva; se detecta automáticamente.
- Q: ¿Cómo se migran las dos patas de una transferencia? → A: Se emparejan en un solo movimiento de tipo transferencia cuando ambas patas caen en cuentas migradas; las demás quedan como ingreso o egreso.
- Q: ¿Bolsillo es subcuenta de Bancolombia o cuenta independiente? → A: Ninguna de las dos: Bolsillo se **fusiona con Efectivo** en una sola cuenta. Las transferencias entre Efectivo y Bolsillo desaparecen porque se vuelven movimientos de una cuenta a sí misma.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Traer el historial de movimientos en COP a la nueva app (Priority: P1)

Como dueño de los datos, quiero ejecutar una vez un proceso que lea el respaldo de la base antigua y cargue en la nueva base mis movimientos en pesos colombianos. Así veo en la app todo mi historial y el saldo correcto de cada cuenta, con las transferencias registradas como tales, sin escribir nada a mano.

**Why this priority**: es el objetivo de la feature. Sin el historial, los saldos de la app nueva no coinciden con la realidad.

**Independent Test**: ejecutar la migración sobre una base nueva con el usuario ya creado, sincronizar la app y comparar movimientos y saldos con el origen.

**Acceptance Scenarios**:

1. **Given** el dump y una base nueva con el usuario creado, **When** se ejecuta la migración, **Then** se procesan los 2.137 movimientos de las ubicaciones 1, 2, 5, 6, 7 y 8, y en la base nueva quedan 1.922: 201 transferencias y 1.721 ingresos o egresos (los 7 pares entre Efectivo y Bolsillo se descartan).
2. **Given** un movimiento antiguo con monto positivo (p. ej. id 1, "Ingreso Daniela J", 94100.00, Efectivo), **When** se migra, **Then** queda como **ingreso** de 94.100,00 COP en la cuenta Efectivo, con la misma descripción y fecha.
3. **Given** un movimiento antiguo con monto negativo, **When** se migra, **Then** queda como **egreso** con el valor absoluto del monto.
4. **Given** un par de patas del origen ("Transferencia a Nequi" −50.000 en Bancolombia y "Transferencia desde Bancolombia" +50.000 en Nequi, mismo día), **When** se migra, **Then** queda **una sola** transferencia de 50.000 de Bancolombia a Nequi.
5. **Given** una pata sin pareja (p. ej. "Transferencia a CDT" en Efectivo, cuyo destino no se migra), **When** se migra, **Then** queda como egreso (o ingreso) normal y el saldo cuadra.
6. **Given** un par entre Efectivo y Bolsillo (p. ej. movimientos 1115/1116, 122.800), **When** se migra, **Then** ninguna de las dos patas aparece, porque su efecto neto en la cuenta fusionada es 0.
7. **Given** movimientos con ubicación 3 o 9 (CDT Bancamia) o 4 (Paypal, USD), **When** se migra, **Then** ninguno aparece en la base nueva.
8. **Given** la migración terminada, **When** se calcula el saldo de cada cuenta, **Then** es igual a la suma con signo de los montos de sus ubicaciones en el origen (Efectivo = Efectivo + Bolsillo).

---

### User Story 2 - Cuentas destino creadas y con el estado correcto (Priority: P1)

Como usuario, quiero que las cuentas de la base antigua existan en la nueva con su nombre. Efectivo (que absorbe Bolsillo), Nequi y Bancolombia deben quedar activas. A la mano y Global66 deben quedar archivadas, pero con su historial completo.

**Why this priority**: los movimientos necesitan una cuenta destino. Sin ella la migración no puede ejecutarse.

**Independent Test**: tras la migración, revisar la lista de cuentas: 3 activas y 2 archivadas, todas en COP, y ninguna llamada Bolsillo.

**Acceptance Scenarios**:

1. **Given** una base nueva sin estas cuentas, **When** se ejecuta la migración, **Then** se crean Efectivo, Nequi, Bancolombia (activas), A la mano y Global66 (archivadas), todas en COP y con saldo inicial 0.
2. **Given** que ya existe en la base nueva una cuenta no borrada del usuario con el mismo nombre, **When** se ejecuta la migración, **Then** se reutiliza esa cuenta en vez de crear un duplicado.
3. **Given** las cuentas archivadas A la mano y Global66, **When** se consultan sus movimientos, **Then** están todos los del origen: 2 y 20 respectivamente.
4. **Given** la migración terminada, **Then** no se creó ninguna cuenta para Bolsillo, CDT Bancamia ni Paypal, y los movimientos de Bolsillo aparecen en Efectivo.

---

### User Story 3 - Ejecución segura y repetible (Priority: P2)

Como operador, quiero poder volver a ejecutar la migración si falla a mitad o si dudo de haberla corrido, sin duplicar datos. También quiero ver un resumen de lo que hizo antes y después de escribir.

**Why this priority**: es una carga única de datos financieros; un duplicado o una carga a medias sería difícil de detectar y corregir.

**Independent Test**: ejecutar la migración dos veces seguidas y comprobar que el número de movimientos y los saldos no cambian.

**Acceptance Scenarios**:

1. **Given** una migración ya completada, **When** se ejecuta de nuevo, **Then** no se crean movimientos ni cuentas nuevas y el resumen informa 0 insertados.
2. **Given** un error durante la escritura, **When** la migración falla, **Then** la base nueva queda sin ningún cambio de esa ejecución (todo o nada).
3. **Given** el modo de simulación, **When** se ejecuta, **Then** se muestra el resumen (movimientos leídos, incluidos, excluidos por motivo, por cuenta, totales) sin escribir nada.
4. **Given** la migración completada, **When** la app sincroniza (PULL), **Then** recibe las cuentas y los movimientos migrados como cualquier otro cambio del servidor.

---

### Edge Cases

- **Patas hacia o desde CDT**: solo tienen una pata en una cuenta migrada. Quedan como egreso o ingreso, porque son necesarias para que el saldo cuadre.
- **Patas que no coinciden**: hay transferencias cuyas patas difieren en monto (p. ej. movimiento 67: −10.000 en Efectivo y movimiento 68: +179.000 en Nequi; movimientos 1418/1419: −350.000 y +351.188). No se emparejan: cada una queda como egreso o ingreso, tal como está en `movements`.
- **Varias patas posibles el mismo día con el mismo monto**: se emparejan en orden de id de origen, una pata con una sola pareja. Cualquier emparejamiento entre cuentas válidas deja los saldos iguales.
- **Par entre Efectivo y Bolsillo con montos distintos**: no forma par, así que ambas patas se migran como ingreso y egreso en Efectivo. El saldo neto se conserva.
- **Patas con la palabra "Transferencia" pero sin "a"/"desde"** (p. ej. "Transferencia Santiago Baca", "Transferencia..."): no son candidatas; se migran como ingreso o egreso.
- **Fecha inválida** (`0000-00-00`): solo aparece en un movimiento de CDT (excluido). Si apareciera en un movimiento incluido, la migración debe detenerse y reportarlo, no inventar una fecha.
- **Monto cero**: no existe en el origen; la nueva estructura exige monto > 0. Si apareciera, se excluye y se reporta.
- **Descripción vacía o con caracteres especiales** (tildes, ñ, comillas): se conserva tal cual, con la codificación correcta.
- **Ningún usuario o más de uno en la base nueva**: la migración se detiene sin escribir nada e indica cuántos usuarios encontró. No intenta adivinar a cuál asignar los datos.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La migración MUST leer los datos del archivo de respaldo SQL, sin necesitar la base antigua en ejecución.
- **FR-002**: La migración MUST escribir en la base del servidor ya desplegada y asignar el `user_id` de todos los registros (cuentas y movimientos) al **único usuario que existe en la base nueva**, detectado automáticamente. El operador no tiene que indicarlo. Si hay cero usuarios o más de uno, MUST detenerse sin escribir nada. El resumen MUST mostrar el usuario usado (correo e id).
- **FR-003**: MUST migrar solo la tabla de movimientos, y solo los de ubicaciones en COP distintas de CDT: 1 Efectivo, 2 Nequi, 5 Bancolombia, 6 A la mano, 7 Global66 y 8 Bolsillo (este último se carga en Efectivo, ver FR-008). MUST excluir las ubicaciones 3 y 9 (CDT), la 4 (USD) y cualquier movimiento ligado a un CDT.
- **FR-004**: Para los movimientos que no forman par de transferencia (FR-006): monto positivo → ingreso; monto negativo → egreso. MUST guardar el valor absoluto con precisión decimal exacta (2 decimales) en COP.
- **FR-005**: MUST conservar la descripción y la fecha original de cada movimiento. En una transferencia, la descripción es la de la pata de salida.
- **FR-006**: MUST emparejar las patas de transferencia **a partir de los propios movimientos**, no de la tabla `transfers`. Son candidatas las filas cuya descripción empieza por "Transferencia a" o "Transferencia desde". Un par es una pata negativa y una positiva con la misma fecha, el mismo valor absoluto y ubicaciones distintas; cada pata participa en un solo par, buscando en orden de id. Cada par se migra como **una sola transferencia**: el origen es la cuenta de la pata negativa, el destino la de la positiva y el monto el valor absoluto. Las patas sin pareja siguen FR-004.
- **FR-006a**: Si las dos patas de un par caen en la misma cuenta nueva (Efectivo ↔ Bolsillo), MUST descartarse ambas y contarse en el resumen como "descartadas por fusión".
- **FR-007**: Los movimientos migrados MUST quedar sin categoría (pendientes de clasificar) y con origen de categoría manual.
- **FR-008**: MUST crear (o reutilizar por nombre, si ya existen y no están borradas) cinco cuentas en COP con saldo inicial 0: Efectivo (efectivo), Nequi, Bancolombia, A la mano y Global66 (ahorros). A la mano y Global66 MUST quedar archivadas. Las ubicaciones 1 (Efectivo) y 8 (Bolsillo) MUST cargarse ambas en la cuenta Efectivo; no se crea cuenta Bolsillo.
- **FR-009**: MUST ser idempotente: cada movimiento nuevo se identifica de forma determinista por los ids de origen (el de la fila o, en una transferencia, los de sus dos patas). Re-ejecutar no duplica cuentas ni movimientos. El emparejamiento MUST ser determinista, para que el mismo dump dé siempre el mismo resultado.
- **FR-010**: MUST ser atómica: si algo falla, no se guarda ningún cambio de esa ejecución.
- **FR-011**: MUST ofrecer un modo de simulación que muestra el resumen sin escribir.
- **FR-012**: MUST mostrar al terminar un resumen: movimientos leídos, incluidos, excluidos por motivo (CDT, USD, inválidos), transferencias formadas, patas sin pareja, pares descartados por fusión, insertados vs. ya existentes, y conteo y saldo neto por cuenta.
- **FR-013**: Los registros migrados MUST cumplir las reglas de la nueva estructura: aislamiento por usuario, columnas de sincronización con la marca del servidor, y llegar a los dispositivos por el flujo normal de sincronización.
- **FR-014**: La migración MUST ser un script sencillo en JavaScript, ejecutable manualmente por el operador. Las credenciales de la base se pasan por variables de entorno o argumentos, nunca escritos en el código. *(Restricción pedida explícitamente por el usuario.)*

### Key Entities

- **Movimiento antiguo**: fila de `movements` del origen. Su `id` es la clave para la idempotencia, el signo del `amount` da la dirección y `location` indica la cuenta.
- **Mapa de ubicaciones**: correspondencia fija entre ubicación antigua y cuenta nueva (nombre, tipo, archivada sí/no). 1 y 8 → Efectivo; 2 → Nequi; 5 → Bancolombia; 6 → A la mano; 7 → Global66. Las ubicaciones 3, 4 y 9 quedan sin cuenta destino.
- **Par de transferencia**: dos movimientos antiguos (salida y entrada) que se convierten en un solo movimiento nuevo de tipo transferencia.
- **Cuenta nueva**: fila de `accounts` del usuario destino.
- **Movimiento nuevo**: fila de `transactions`: ingreso o egreso ligado a una cuenta, o transferencia entre dos cuentas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Los 2.137 movimientos incluidos quedan representados en la base nueva: 1.922 registros (201 transferencias + 1.721 ingresos o egresos), con 7 pares descartados por fusión y ninguno de las ubicaciones 3, 4 o 9. Si el plan cambia la regla de emparejamiento, estas cifras se recalculan, pero la regla del resumen debe seguir cuadrando: incluidos = 2 × transferencias + 2 × descartados + sueltos.
- **SC-002**: El saldo de cada cuenta en la app coincide al centavo con la suma con signo del origen: Efectivo (1 + 8) 344.800,00; Nequi 6,91; Bancolombia 200.000,79; A la mano 0,00; Global66 0,00.
- **SC-003**: Ejecutar la migración una segunda vez deja 0 registros nuevos y los saldos sin cambios.
- **SC-004**: La migración completa termina en menos de 1 minuto.
- **SC-005**: Tras sincronizar, la app muestra 3 cuentas activas y 2 archivadas con todo su historial, sin acciones manuales adicionales.
- **SC-006**: Ninguna transferencia emparejada cuenta como gasto ni como ingreso personal en el dashboard.

## Assumptions

- La base nueva ya tiene el esquema aplicado (migraciones del servidor) y el usuario destino ya existe. La migración no crea usuarios.
- Se migra a un único usuario: el origen es de un solo usuario y la base nueva tiene hoy un solo usuario (el creado por la seed del primer despliegue), que es al que se asignan los datos.
- Las fechas del origen son fechas locales de Colombia (sin hora). Se guardan como la medianoche de ese día en hora de Colombia (UTC−5), convertida a UTC, para que la app las muestre en el día correcto.
- La fecha de creación y la de modificación de los registros migrados son las de la ejecución; la fecha del movimiento es la original.
- El saldo inicial de cada cuenta es 0 porque se migra todo su historial.
- Tipos de cuenta: Efectivo → efectivo; Nequi, Bancolombia, A la mano y Global66 → ahorros.
- La fusión Efectivo + Bolsillo es definitiva: después de migrar no se puede saber qué movimiento venía de Bolsillo, salvo por su descripción.
- Los CDT (cuentas, títulos y movimientos) los cargará el usuario a mano después. Los saldos de las cuentas migradas incluyen las salidas y entradas hacia y desde los CDT, porque así están en el origen.
- La migración la ejecuta el propio operador con acceso de red a la base del servidor. Se recomienda un respaldo de la base nueva antes de ejecutarla.
