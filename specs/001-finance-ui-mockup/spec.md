# Feature Specification: Interfaz de la app (shell, dashboard y módulo de finanzas) con datos de prueba

**Feature Branch**: `001-finance-ui-mockup`

**Created**: 2026-10-17

**Status**: Draft

**Input**: User description: "basado en los documentos que se encuentran en las carpetas, vamos a iniciar la creación de la UI. Para la creación de la UI usa mockup data por ahora, no entremos aún a diseñar la base de datos, solo interfaces. Crea la interfaz móvil en React Native teniendo en cuenta que debe funcionar también en web, recuerda que en el MVP solo estamos creando el módulo de finanzas, pero la app requerirá un dashboard y un menú de navegación."

**Documentos de referencia**: [`docs/modulo-finanzas.md`](../../docs/modulo-finanzas.md) (funcionalidades, §1–§11) y [`docs/db-finanzas.md`](../../docs/db-finanzas.md) (forma de los datos que la UI debe poder mostrar).

## Resumen

Construir la primera versión **navegable** de la interfaz de BermudezTechOS: la estructura general de la app (navegación y dashboard principal) y todas las pantallas del módulo de **finanzas personales** que forman parte del MVP. Toda la información mostrada proviene de **datos de prueba (mockup)** cargados en memoria: no hay persistencia, sincronización, autenticación real ni conexión con el servidor. El objetivo es validar flujos, jerarquía de información y estética (*liquid glass*) en Android y en navegador web antes de construir la capa de datos.

## Alcance

**Incluido** (secciones de `docs/modulo-finanzas.md`):

- Estructura de la app: menú de navegación (con accesos a módulos futuros como "Próximamente") y dashboard principal, que en esta fase solo muestra un saludo.
- §1 Cuentas y subcuentas (cajitas) · §2 Movimientos (ingresos, egresos, transferencias) · §3 Tarjetas de crédito · §11 Dashboard de gastos por categoría · §7 Patrimonio neto · §10 CDTs · §4 Suscripciones · §5 Grupos de reembolso · §6 Sugerencia de categoría por IA (solo representación visual).
- Formularios de creación y edición con validación en pantalla; los cambios se reflejan en la sesión actual.
- Tema claro y oscuro.

**Excluido**:

- Diseño e implementación de base de datos local o del servidor, sincronización y API.
- Autenticación real (inicio/cierre de sesión, tokens).
- §8 Asistencia fiscal DIAN y §9 Importación de extractos (fuera del MVP).
- Módulos de rutinas, calendario, to-do y hábitos (solo aparecen como accesos del menú "Próximamente").
- Widgets y datos en el dashboard principal (se definirán en una fase posterior).
- Llamadas reales a un modelo de IA, notificaciones y recordatorios reales.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Navegar la app y ver el dashboard principal (Priority: P1)

Como usuario, al abrir la app veo un dashboard principal que, por ahora, solo me saluda (sin widgets ni datos), y un menú de navegación que me permite moverme entre las secciones de la app. Los módulos que aún no existen (Rutinas, Calendario, To-do, Hábitos) aparecen como "Próximamente".

**Why this priority**: Es el esqueleto sobre el que se montan todas las demás pantallas; sin navegación ni dashboard no hay app demostrable. Además fija la base para añadir módulos futuros sin rehacer la estructura.

**Independent Test**: Abrir la app en Android y en un navegador web, comprobar que el dashboard muestra el saludo y que desde el menú se llega a cada sección y se vuelve al dashboard.

**Acceptance Scenarios**:

1. **Given** la app recién abierta, **When** carga, **Then** se muestra el dashboard principal con un saludo al usuario de prueba y ningún widget ni dato financiero.
2. **Given** el dashboard, **When** el usuario quiere ver sus finanzas, **Then** accede a ellas desde el menú de navegación (entrada "Finanzas").
3. **Given** cualquier pantalla, **When** el usuario usa el menú de navegación, **Then** puede ir a Inicio, Finanzas y Ajustes, y ve los módulos futuros marcados como "Próximamente" sin poder entrar a ellos.
4. **Given** la app abierta en una pantalla ancha (navegador de escritorio), **When** se muestra, **Then** el menú se presenta como barra lateral y el contenido aprovecha el ancho; **Given** una pantalla de teléfono, **Then** el menú se presenta como barra inferior.
5. **Given** el usuario cambia entre tema claro y oscuro en Ajustes, **When** vuelve a cualquier pantalla, **Then** toda la interfaz respeta el tema elegido.

---

### User Story 2 - Consultar cuentas, subcuentas y tarjetas (Priority: P1)

Como usuario, veo la lista de mis cuentas principales (ahorros, corriente, efectivo, inversión) y tarjetas de crédito con su saldo; dentro de cada cuenta veo sus cajitas, el saldo total y el saldo disponible (excluyendo lo apartado). En las tarjetas veo la deuda actual, el cupo y los días de corte y pago.

**Why this priority**: Las cuentas son el primer paso del orden de implementación (§1, §3) y el contexto de casi todo lo demás.

**Independent Test**: Entrar a Finanzas → Cuentas, abrir una cuenta con cajitas y una tarjeta de crédito y verificar que los saldos mostrados coinciden con los datos de prueba.

**Acceptance Scenarios**:

1. **Given** datos de prueba con varias cuentas, **When** el usuario abre "Cuentas", **Then** ve las cuentas agrupadas en activos (bancarias, efectivo, inversión) y pasivos (tarjetas), cada una con nombre, ícono/color y saldo.
2. **Given** una cuenta con cajitas, **When** el usuario la abre, **Then** ve el saldo total, el saldo disponible, la lista de cajitas con su saldo y los movimientos de la cuenta.
3. **Given** una tarjeta de crédito, **When** el usuario la abre, **Then** ve la deuda actual, el cupo, el cupo disponible, el porcentaje usado y los días de corte y de pago.
4. **Given** el formulario "Nueva cuenta", **When** el usuario elige tipo, nombre, saldo inicial (y para tarjetas, cupo y días de corte/pago) y guarda, **Then** la cuenta aparece en la lista durante la sesión.
5. **Given** una cuenta archivada en los datos de prueba, **When** se ve la lista, **Then** no aparece por defecto pero puede mostrarse con un filtro "Archivadas".

---

### User Story 3 - Registrar y consultar movimientos (Priority: P1)

Como usuario, registro un ingreso, egreso o transferencia en pocos toques desde cualquier pantalla de finanzas, y consulto el historial de movimientos filtrando por cuenta, tipo, categoría y rango de fechas.

**Why this priority**: El registro "cero fricción" es el núcleo del módulo (§2); es la acción más frecuente del usuario.

**Independent Test**: Usar el botón de acción rápida para registrar un egreso, verlo en el historial y en el saldo de la cuenta durante la sesión.

**Acceptance Scenarios**:

1. **Given** cualquier pantalla de finanzas, **When** el usuario pulsa el botón de nuevo movimiento, **Then** se abre un formulario con tipo (ingreso/egreso/transferencia), monto, cuenta, fecha (por defecto hoy), categoría y descripción.
2. **Given** el tipo "Transferencia", **When** se muestra el formulario, **Then** pide cuenta origen y destino, oculta la categoría y no permite elegir la misma cuenta en ambos.
3. **Given** un monto vacío, cero, negativo o con más de 2 decimales, **When** el usuario intenta guardar, **Then** ve un mensaje de validación y el movimiento no se guarda.
4. **Given** un movimiento guardado, **When** el usuario vuelve al historial o a la cuenta, **Then** el movimiento aparece y el saldo mostrado de la cuenta se actualiza.
5. **Given** el historial, **When** el usuario aplica filtros, **Then** solo ve los movimientos que cumplen todos los filtros, agrupados por día y con el total del periodo filtrado.
6. **Given** un movimiento existente, **When** el usuario lo abre, **Then** puede editarlo o eliminarlo (con confirmación).
7. **Given** un movimiento con categoría sugerida por IA en los datos de prueba, **When** se muestra, **Then** lleva un distintivo de "sugerida" y el usuario puede cambiar la categoría, tras lo cual el distintivo desaparece.

---

### User Story 4 - Ver gasto por categoría (Priority: P2)

Como usuario, veo cuánto gasté en el mes o en el año agrupado por categoría, comparado con el periodo anterior y con una gráfica de evolución.

**Why this priority**: Es el siguiente paso del orden de implementación (§11) y la principal fuente de valor analítico.

**Independent Test**: Abrir "Gastos por categoría", alternar mes/año y navegar entre periodos verificando totales contra los datos de prueba.

**Acceptance Scenarios**:

1. **Given** datos de prueba de varios meses, **When** el usuario abre la vista en modo "Mes", **Then** ve el total gastado del mes, un gráfico de distribución por categoría y la lista de categorías con monto, porcentaje y variación frente al mes anterior.
2. **Given** la vista, **When** el usuario cambia a "Año" o navega al periodo anterior/siguiente, **Then** los datos se recalculan para ese periodo.
3. **Given** transferencias internas, pagos de tarjeta y gastos de grupos de reembolso en los datos, **When** se calculan los totales, **Then** quedan excluidos.
4. **Given** una categoría de la lista, **When** el usuario la toca, **Then** ve los movimientos de esa categoría en el periodo.
5. **Given** la vista, **Then** se muestra una gráfica de evolución del gasto total de los últimos 6 meses (o años, en modo "Año").

---

### User Story 5 - Ver patrimonio neto (Priority: P2)

Como usuario, veo mi patrimonio neto (activos − pasivos), el desglose por cuentas, CDTs y bienes, y su evolución en el tiempo.

**Why this priority**: Vista global de salud financiera (§7).

**Independent Test**: Abrir "Patrimonio" y verificar que el total coincide con activos − pasivos de los datos de prueba, excluyendo lo marcado como excluido.

**Acceptance Scenarios**:

1. **Given** datos de prueba, **When** el usuario abre "Patrimonio", **Then** ve el patrimonio neto, el total de activos, el total de pasivos y el desglose por grupo (cuentas, inversiones, bienes, tarjetas/deudas).
2. **Given** una cuenta marcada como excluida del patrimonio, **When** se muestra el desglose, **Then** aparece identificada como excluida y no suma al total.
3. **Given** un bien cuya fecha de validez del valor ya pasó, **When** se muestra, **Then** aparece un aviso para actualizar su valor.
4. **Given** la vista, **Then** se muestra una gráfica de evolución del patrimonio neto de los últimos 12 meses.
5. **Given** el formulario de bien, **When** el usuario registra nombre, valor estimado y fecha de validez, **Then** el bien aparece en el desglose durante la sesión.

---

### User Story 6 - Seguir CDTs (Priority: P3)

Como usuario, veo un resumen de mis CDTs (total invertido, rendimiento promedio ponderado, próximos vencimientos) y el detalle de cada uno con valor actual estimado y valor esperado al vencimiento.

**Why this priority**: Inversiones en el MVP (§10); uso menos frecuente que las vistas anteriores.

**Independent Test**: Abrir "Inversiones", revisar el resumen y el detalle de un CDT, y registrar uno nuevo.

**Acceptance Scenarios**:

1. **Given** CDTs de prueba, **When** el usuario abre "Inversiones", **Then** ve total invertido, rendimiento promedio ponderado y la lista de CDTs ordenada por fecha de vencimiento.
2. **Given** un CDT, **When** lo abre, **Then** ve entidad, capital, tasa E.A. y nominal, plazo, fechas de apertura y vencimiento, modalidad de pago de intereses, retención, interés causado a la fecha, valor actual estimado y valor esperado neto al vencimiento.
3. **Given** un CDT que vence en 15 días o menos, **When** se muestra en la lista, **Then** lleva un indicador de "próximo a vencer".
4. **Given** el formulario de nuevo CDT, **When** el usuario ingresa los datos, **Then** la fecha de vencimiento se calcula a partir de la apertura y el plazo, y el CDT aparece en la lista durante la sesión.

---

### User Story 7 - Gestionar suscripciones (Priority: P3)

Como usuario, veo mis gastos fijos recurrentes con su próximo cobro y el total mensual equivalente, y puedo crear, editar, pausar o cancelar suscripciones.

**Why this priority**: §4; útil pero no bloquea el resto.

**Independent Test**: Abrir "Suscripciones", crear una mensual y pausar otra, verificando el cambio en el total mensual.

**Acceptance Scenarios**:

1. **Given** suscripciones de prueba, **When** el usuario abre "Suscripciones", **Then** ve cada una con ícono, nombre, monto, periodicidad, próxima fecha de cobro, cuenta y estado, y un total mensual equivalente de las activas (las anuales prorrateadas entre 12).
2. **Given** el formulario, **When** el usuario elige periodicidad anual, **Then** se le pide también el mes de cobro.
3. **Given** una suscripción activa, **When** el usuario la pausa o cancela, **Then** su estado cambia y deja de sumar al total mensual.

---

### User Story 8 - Gestionar grupos de reembolso (Priority: P3)

Como usuario, veo mis grupos de reembolso/adelanto abiertos con su saldo (me deben / tengo dinero de terceros / saldado) y los movimientos de cada grupo, y puedo asociar un movimiento a un grupo al registrarlo.

**Why this priority**: §5; caso de uso específico, último en el orden de implementación junto con IA.

**Independent Test**: Abrir "Reembolsos", revisar un grupo de tipo reembolso y uno de adelanto, y registrar un gasto asociado a un grupo.

**Acceptance Scenarios**:

1. **Given** grupos de prueba, **When** el usuario abre "Reembolsos", **Then** ve los grupos abiertos con nombre, pagador, tipo, estado y saldo, y un total de lo pendiente por cobrar y por devolver.
2. **Given** un grupo con saldo negativo, **Then** se muestra como "Te deben" con el monto en positivo; con saldo positivo, como "Tienes de terceros"; con saldo cero, como "Saldado".
3. **Given** el formulario de nuevo movimiento, **When** el usuario lo asocia a un grupo, **Then** el movimiento aparece en el grupo y el saldo del grupo se actualiza.
4. **Given** un grupo con saldo cero, **When** el usuario lo marca como saldado, **Then** pasa a la sección de grupos cerrados.

---

### Edge Cases

- **Sin datos**: cada lista (cuentas, movimientos, suscripciones, CDTs, grupos, bienes) tiene un estado vacío con mensaje y acción para crear el primer elemento; los datos de prueba deben incluir un modo o conjunto que permita ver estos estados.
- **Montos grandes**: valores de hasta 999.999.999.999,99 COP se muestran completos sin cortarse ni desbordar su contenedor; en tarjetas de resumen pueden abreviarse (p. ej. "1,2 M") con el valor completo accesible.
- **Saldos negativos** (deudas, sobregiros, grupos que me deben) se distinguen visualmente y no dependen solo del color (signo o etiqueta).
- **Textos largos** en nombres y descripciones se truncan con elipsis sin romper el diseño.
- **Categoría sin asignar**: los movimientos sin categoría se muestran como "Sin categoría" y se agrupan así en el dashboard de gastos.
- **Día de cobro inexistente** (p. ej. 31 en febrero): la próxima fecha mostrada es el último día del mes.
- **Periodo sin gastos** en el dashboard de categorías: muestra estado vacío en lugar de un gráfico vacío.
- **Eliminar una cuenta con movimientos o cajitas**: se pide confirmación y se ofrece archivar en lugar de eliminar.
- **Recarga en web**: al recargar el navegador los cambios de la sesión se pierden y se vuelve a los datos de prueba iniciales (comportamiento esperado en esta fase).
- **Ventana redimensionada en web**: la navegación cambia entre barra inferior y lateral sin perder la pantalla actual.

## Requirements *(mandatory)*

### Functional Requirements

**Estructura y navegación**

- **FR-001**: La app MUST funcionar en Android y en navegador web con las mismas pantallas y flujos.
- **FR-002**: La app MUST ofrecer un menú de navegación principal con: Inicio (dashboard), Finanzas, Ajustes y los módulos futuros (Rutinas, Calendario, To-do, Hábitos) marcados como "Próximamente" y no navegables.
- **FR-003**: El menú MUST adaptarse al tamaño de pantalla: barra inferior en teléfonos y barra lateral en pantallas anchas (≥ 1024 px de ancho).
- **FR-004**: La sección Finanzas MUST dar acceso a: Resumen, Cuentas, Movimientos, Gastos por categoría, Patrimonio, Inversiones, Suscripciones y Reembolsos.
- **FR-005**: La estructura de navegación MUST permitir añadir un módulo nuevo como una entrada más del menú sin reorganizar las existentes.
- **FR-006**: Cada pantalla de detalle MUST permitir volver a la anterior (botón atrás del sistema en Android, botón de navegación y del navegador en web).

**Dashboard principal**

- **FR-007**: El dashboard MUST mostrar únicamente un saludo con el nombre del usuario de prueba, según la hora local ("Buenos días", "Buenas tardes", "Buenas noches").
- **FR-008**: El dashboard MUST NOT mostrar widgets, indicadores ni datos financieros en esta fase.
- **FR-009**: El dashboard MUST respetar la estética y el tema de la app, de modo que puedan añadirse widgets en una fase posterior sin rediseñar la pantalla.

**Cuentas y tarjetas (§1, §3)**

- **FR-010**: Los usuarios MUST poder ver la lista de cuentas agrupada en activos y pasivos, con saldo por cuenta y totales por grupo.
- **FR-011**: El detalle de cuenta MUST mostrar saldo total, saldo disponible, cajitas con su saldo y movimientos de la cuenta.
- **FR-012**: El detalle de tarjeta MUST mostrar deuda actual, cupo, cupo disponible, porcentaje de uso y días de corte y pago.
- **FR-013**: Los usuarios MUST poder crear, editar y archivar cuentas, cajitas y tarjetas mediante formularios con validación.
- **FR-014**: Mover dinero entre una cuenta y su cajita MUST presentarse como una transferencia.

**Movimientos (§2, §6)**

- **FR-015**: Un botón de acción rápida MUST estar disponible en las pantallas de finanzas para registrar un movimiento.
- **FR-016**: El formulario de movimiento MUST soportar ingreso, egreso y transferencia, con los campos de §2, fecha por defecto hoy y asociación opcional a un grupo de reembolso.
- **FR-017**: El formulario MUST validar: monto > 0 con máximo 2 decimales, cuenta obligatoria, cuenta destino distinta del origen en transferencias.
- **FR-018**: El historial MUST agrupar por día, mostrar el total del periodo y permitir filtrar por cuenta, tipo, categoría y rango de fechas, y buscar por descripción.
- **FR-019**: Los usuarios MUST poder editar y eliminar movimientos, con confirmación al eliminar.
- **FR-020**: Los movimientos con categoría sugerida por IA MUST mostrar un distintivo visible que desaparece cuando el usuario confirma o cambia la categoría.

**Análisis (§11, §7)**

- **FR-021**: La vista de gastos por categoría MUST mostrar total, distribución por categoría, porcentaje y variación frente al periodo anterior, en modo mes o año, con navegación entre periodos y gráfica de evolución.
- **FR-022**: Los cálculos de gasto MUST excluir transferencias, pagos de tarjeta y movimientos de grupos de reembolso.
- **FR-023**: La vista de patrimonio MUST mostrar patrimonio neto, activos, pasivos, desglose, elementos excluidos identificados y gráfica de evolución de 12 meses.
- **FR-024**: Los usuarios MUST poder registrar y editar bienes (nombre, valor estimado, fecha de validez) y ver un aviso cuando el valor está vencido.

**Inversiones, suscripciones y reembolsos (§10, §4, §5)**

- **FR-025**: La vista de inversiones MUST mostrar total invertido, rendimiento promedio ponderado, lista de CDTs ordenada por vencimiento e indicador de próximo vencimiento (≤ 15 días).
- **FR-026**: El detalle de CDT MUST mostrar los campos de §10 más interés causado a la fecha, valor actual estimado y valor neto esperado al vencimiento (descontada la retención).
- **FR-027**: Los usuarios MUST poder crear CDTs; la fecha de vencimiento se calcula a partir de apertura + plazo y puede editarse.
- **FR-028**: La vista de suscripciones MUST mostrar cada suscripción con su próximo cobro y el total mensual equivalente de las activas; los usuarios MUST poder crear, editar, pausar, reanudar y cancelar suscripciones.
- **FR-029**: La vista de reembolsos MUST mostrar grupos abiertos y cerrados, el saldo de cada grupo con su interpretación ("Te deben" / "Tienes de terceros" / "Saldado") y totales pendientes; los usuarios MUST poder crear grupos y marcarlos como saldados.

**Datos de prueba**

- **FR-030**: Toda la información MUST provenir de un conjunto de datos de prueba realista en COP que cubra todos los tipos de cuenta, al menos 3 meses de movimientos con varias categorías, al menos 2 CDTs (uno próximo a vencer), suscripciones mensuales y anuales, un grupo de reembolso y uno de adelanto, al menos un bien con valor vencido y una cuenta excluida del patrimonio.
- **FR-031**: Los datos de prueba MUST respetar la forma de los datos descrita en `docs/db-finanzas.md` (entidades, relaciones y reglas de saldo derivado) para que la capa de datos real pueda sustituirlos sin rediseñar pantallas.
- **FR-032**: Los cambios hechos con los formularios MUST reflejarse en todas las pantallas durante la sesión; no se requiere que persistan al cerrar o recargar la app.
- **FR-033**: Los saldos, totales y estadísticas MUST calcularse a partir de los movimientos de prueba, no escribirse como valores fijos.

**Presentación**

- **FR-034**: Los montos MUST mostrarse en formato colombiano (símbolo $, separador de miles "." y decimal ","), y los cálculos con montos MUST ser exactos (sin errores de redondeo).
- **FR-035**: Las fechas MUST mostrarse en la zona horaria local del dispositivo y en español.
- **FR-036**: La interfaz MUST seguir la estética *liquid glass* (superficies translúcidas, colores vibrantes, bordes suaves, transiciones fluidas) definida en un sistema de tema centralizado, con modo claro, oscuro y "según el sistema".
- **FR-037**: Toda la interfaz MUST estar en español.
- **FR-038**: Los elementos interactivos MUST tener área táctil mínima de 44×44 pt y etiquetas accesibles; el texto MUST mantener contraste legible sobre las superficies translúcidas en ambos temas.
- **FR-039**: La pantalla de Ajustes MUST incluir selección de tema, el usuario de prueba y una opción "Restablecer datos de prueba".

### Key Entities *(datos de prueba; forma definida en `docs/db-finanzas.md`)*

- **Usuario de prueba**: nombre para mostrar; un único usuario en esta fase.
- **Cuenta**: nombre, tipo (corriente, ahorros, efectivo, tarjeta de crédito, cajita, inversión), naturaleza (activo/pasivo), ícono/color, saldo inicial, cupo y días de corte/pago (tarjetas), excluida del patrimonio, archivada. Una cajita pertenece a una cuenta principal.
- **Categoría**: nombre, tipo (ingreso/egreso), ícono/color.
- **Movimiento**: tipo, monto, cuenta, cuenta destino (transferencias), categoría y su origen (manual/IA), fecha, descripción, grupo de reembolso, suscripción o CDT asociados.
- **Suscripción**: nombre, ícono, monto, periodicidad, día/mes de cobro, cuenta, categoría, estado.
- **Grupo de reembolso**: nombre, pagador, tipo (reembolso/adelanto), estado, notas; su saldo se deriva de sus movimientos.
- **CDT**: entidad, número de título, capital, tasas E.A. y nominal, plazo, fechas, modalidad de intereses, retención, cuentas de origen y destino, estado, CDT anterior si es renovación.
- **Bien**: nombre, valor estimado, fecha de validez del valor.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de las pantallas listadas en el alcance son accesibles desde el menú en Android y en navegador web, en no más de 3 toques/clics desde el inicio.
- **SC-002**: Un usuario puede registrar un egreso desde la sección Finanzas en menos de 15 segundos y en no más de 5 interacciones.
- **SC-003**: Todos los saldos y totales mostrados coinciden exactamente (al centavo) con el cálculo manual sobre los datos de prueba.
- **SC-004**: Las transiciones entre pantallas y las animaciones se perciben fluidas (sin saltos visibles) en un teléfono Android de gama media.
- **SC-005**: Ningún texto, monto o elemento queda cortado o desbordado en anchos de pantalla entre 360 px y 1920 px.
- **SC-006**: En una revisión con al menos 3 personas, todas encuentran sin ayuda, partiendo del dashboard, su saldo disponible, su gasto del mes y cómo registrar un movimiento.
- **SC-007**: Añadir un nuevo módulo al menú (como prueba con un módulo ficticio) requiere solo agregar su entrada, sin modificar las demás pantallas.
- **SC-008**: Todas las pantallas son legibles y consistentes en modo claro y oscuro.

## Assumptions

- La tecnología del cliente es la definida en `CLAUDE.md` (app móvil multiplataforma Android + web); esta spec no define detalles técnicos, que corresponden a `/speckit-plan`.
- No hay pantalla de inicio de sesión funcional en esta fase: la app arranca directamente con un usuario de prueba. Una pantalla de login visual podrá añadirse en la feature de autenticación.
- Los datos de prueba viven en memoria y se reinician al cerrar/recargar la app; esto es aceptable porque la persistencia local se diseñará en una feature posterior.
- Moneda única COP en toda la interfaz, según las decisiones del módulo.
- La sugerencia de categoría por IA solo se representa visualmente con datos de prueba; no hay clasificación real.
- Los recordatorios (corte/pago de tarjeta, cobro de suscripciones, vencimiento de CDT) se muestran como indicadores dentro de la app, sin notificaciones del sistema.
- La renovación de CDTs y el registro del pago al vencimiento se muestran en el detalle del CDT como acción; su flujo completo puede simplificarse en esta fase.
- La constitución del proyecto (`.specify/memory/constitution.md`) aún no está definida; se toman como principios los de `CLAUDE.md`.
