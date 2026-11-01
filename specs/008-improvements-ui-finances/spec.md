# Feature Specification: Mejoras de UI en Finanzas (meses anteriores, categorías y periodos de patrimonio)

**Feature Branch**: `008-improvements-ui-finances`

**Created**: 2026-10-31

**Status**: Draft

**Input**: User description: "Vamos a trabajar en el frontend en nuevos features. Para ello, he creado una nueva rama 008-improvements-ui-finances que es el mismo nombre que quiero que le des a la spec. En la pantalla inicial en los stats de finanzas se debe poder seleccionar otro mes anterior para actualizar ingresos, gastos y balance del mes seleccionado o crear una pantalla dedicada como la de gastos por categoría también para ingresos y crear una pantalla dedicada para balance. En el menú de secciones, debe haber un nuevo módulo que permitirá crear y editar las categorías ya existentes tanto para ingresos como para egresos. Éste menú debe permitir seleccionar de un menú de íconos mucho más amplio y una paleta de colores ya predefinida. Patrimonio debe permitir seleccionar en la gráfica no solo los últimos 12 meses sino periodos de 6 meses, 12 meses, 24 meses y todo el tiempo"

## Contexto

Hoy el Resumen de Finanzas muestra tres estadísticas fijas al mes en curso (Ingresos del mes, Gastos del mes, Balance del mes) y la tarjeta de Patrimonio. Existe una pantalla "Gastos por categoría" con modo mes/año, navegación entre periodos, distribución por categoría, variación frente al periodo anterior y gráfica de evolución; no existe equivalente para ingresos ni para balance. Las categorías de ingreso y egreso existen y se sincronizan, pero el usuario no puede crearlas ni editarlas desde la app. La gráfica de Patrimonio muestra siempre los últimos 12 meses.

Esta feature es solo de cliente: no cambia el modelo de datos ni el servidor.

## Clarifications

### Session 2026-10-31

- Q: ¿Además de crear y editar, el usuario debe poder eliminar o archivar categorías? → A: No; solo crear y editar. Archivar y eliminar quedan fuera de alcance (el usuario consideró archivar y lo descartó).
- Q: ¿Debe poder crearse una categoría nueva desde el propio formulario? → A: Sí, solo en el formulario de movimientos: un chip "+ Nueva" abre el editor de categoría y, al guardar, la deja seleccionada.
- Q: En el selector de mes del Resumen, ¿cómo llega el usuario a un mes lejano? → A: Flechas anterior/siguiente y, además, tocar el nombre del mes abre una lista de meses agrupada por año, desde el primer mes con movimientos hasta el mes en curso.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cambiar el mes de las estadísticas del Resumen (Priority: P1)

Como usuario, quiero elegir un mes anterior directamente en el Resumen de Finanzas para que las tarjetas de ingresos, gastos y balance muestren ese mes, y así revisar rápido cómo me fue sin salir de la pantalla inicial.

**Why this priority**: es la consulta más frecuente que hoy no se puede hacer y la más rápida de usar; aporta valor inmediato con los datos existentes.

**Independent Test**: con datos de varios meses, elegir un mes anterior en el Resumen y comprobar que ingresos, gastos y balance coinciden con la suma de los movimientos de ese mes.

**Acceptance Scenarios**:

1. **Given** el Resumen, **When** se abre, **Then** sobre las estadísticas aparece un selector de mes que muestra el mes en curso (p. ej. "octubre 2026") con flechas para ir al mes anterior y al siguiente.
2. **Given** el selector, **When** el usuario toca el nombre del mes, **Then** se abre una lista de meses agrupada por año, desde el primer mes con movimientos hasta el mes en curso, con el mes actual marcado; al elegir uno, la lista se cierra y las tarjetas se actualizan a ese mes.
3. **Given** el primer mes con movimientos seleccionado, **When** intenta retroceder, **Then** no puede: la flecha de mes anterior está deshabilitada.
4. **Given** un usuario sin movimientos, **When** abre el Resumen, **Then** el selector muestra solo el mes en curso, con ambas flechas deshabilitadas.
5. **Given** movimientos en varios meses, **When** el usuario elige un mes anterior, **Then** las tarjetas de ingresos, gastos y balance muestran los totales de ese mes y su etiqueta indica el mes elegido (p. ej. "Ingresos · septiembre 2026").
6. **Given** un mes anterior seleccionado, **When** se muestra la variación, **Then** se compara contra el mes inmediatamente anterior al seleccionado.
7. **Given** un mes anterior seleccionado, **When** el usuario toca una de las tres tarjetas, **Then** se abre su pantalla dedicada (Ingresos por categoría, Gastos por categoría o Balance) en ese mismo mes, no en el mes en curso.
8. **Given** el mes en curso seleccionado, **When** intenta avanzar al mes siguiente, **Then** no puede: el control de avanzar está deshabilitado.
9. **Given** un mes anterior seleccionado, **When** el usuario quiere volver, **Then** hay un acceso directo para regresar al mes en curso en un toque.
10. **Given** un mes sin movimientos, **When** se selecciona, **Then** los totales se muestran en cero y no aparece error.
11. **Given** un mes anterior seleccionado, **When** se muestran las demás tarjetas del Resumen (Patrimonio, Movimientos recientes), **Then** no cambian: el selector afecta solo a ingresos, gastos y balance.
12. **Given** que el usuario cierra y vuelve a abrir la app, **When** se abre el Resumen, **Then** vuelve a mostrar el mes en curso.

---

### User Story 2 - Pantalla dedicada de ingresos por categoría (Priority: P2)

Como usuario, quiero una pantalla "Ingresos por categoría" equivalente a la de gastos, para ver de dónde viene mi dinero en el mes en curso o en cualquier mes o año anterior, y cómo evoluciona.

**Why this priority**: da el desglose y la evolución que las tarjetas del Resumen no pueden mostrar; completa la simetría con gastos y reutiliza un patrón que el usuario ya conoce.

**Independent Test**: abrir "Ingresos por categoría", alternar mes/año y navegar entre periodos verificando los totales por categoría contra los datos.

**Acceptance Scenarios**:

1. **Given** ingresos de varias categorías, **When** el usuario abre la pantalla en modo "Mes", **Then** ve el total de ingresos del mes, su variación frente al mes anterior, una gráfica de distribución por categoría y la lista de categorías con monto, porcentaje y variación.
2. **Given** la pantalla abierta, **When** cambia a modo "Año" o navega a periodos anteriores, **Then** todos los valores se recalculan para el periodo elegido.
3. **Given** una categoría de la lista, **When** la toca, **Then** ve los movimientos de ingreso de esa categoría en ese periodo.
4. **Given** la pantalla, **When** se muestra la evolución, **Then** aparece una gráfica de los últimos 6 meses (o 6 años en modo año), igual que en gastos.
5. **Given** ingresos sin categoría, **When** se agrupan, **Then** aparecen como "Sin categoría".
6. **Given** un periodo sin ingresos, **When** se muestra, **Then** aparece un estado vacío en lugar de una gráfica vacía.
7. **Given** el Resumen con un mes seleccionado, **When** el usuario toca la tarjeta de ingresos, **Then** se abre "Ingresos por categoría" en ese mes.
8. **Given** el mes en curso seleccionado, **When** intenta avanzar al periodo siguiente, **Then** no puede: el periodo en curso es el más reciente disponible.

---

### User Story 3 - Pantalla dedicada de balance (Priority: P2)

Como usuario, quiero una pantalla de "Balance" que muestre ingresos, gastos y su diferencia por periodo, para saber si estoy ahorrando o gastando más de lo que gano y cómo cambia en el tiempo.

**Why this priority**: el balance es la métrica de salud financiera más directa; hoy solo se ve el número del mes en curso.

**Independent Test**: abrir "Balance", navegar entre meses y años y comprobar que balance = ingresos − gastos para cada periodo.

**Acceptance Scenarios**:

1. **Given** movimientos del periodo, **When** el usuario abre "Balance" en modo "Mes", **Then** ve el balance del mes (ingresos − gastos), los ingresos y gastos que lo componen y la variación frente al mes anterior.
2. **Given** la pantalla, **When** cambia a modo "Año" o navega entre periodos, **Then** los valores se recalculan para el periodo elegido.
3. **Given** la pantalla, **When** se muestra la evolución, **Then** una gráfica muestra ingresos, gastos y balance de los últimos 6 meses (o 6 años), distinguiendo balances positivos de negativos.
4. **Given** un balance negativo, **When** se muestra, **Then** se destaca visualmente como déficit (color y signo).
5. **Given** la pantalla, **When** el usuario toca ingresos o gastos, **Then** llega a la pantalla de ingresos o gastos por categoría del mismo periodo.
6. **Given** el Resumen con un mes seleccionado, **When** el usuario toca la tarjeta de balance, **Then** se abre "Balance" en ese mes.
7. **Given** un periodo sin movimientos, **When** se selecciona, **Then** ingresos, gastos y balance se muestran en cero sin errores.

---

### User Story 4 - Gestionar categorías de ingresos y egresos (Priority: P2)

Como usuario, quiero una sección "Categorías" en el menú de Finanzas donde pueda crear categorías nuevas y editar las existentes (nombre, ícono y color), tanto de ingresos como de egresos, para clasificar mis movimientos a mi manera.

**Why this priority**: hoy las categorías son fijas; sin poder adaptarlas, los reportes por categoría pierden utilidad.

**Independent Test**: crear una categoría de egreso con ícono y color, usarla en un movimiento, editar su nombre y color y comprobar que el cambio se refleja en movimientos y reportes.

**Acceptance Scenarios**:

1. **Given** el menú de secciones de Finanzas, **When** el usuario lo ve, **Then** aparece la sección "Categorías" y al tocarla ve sus categorías separadas en "Egresos" e "Ingresos", cada una con su ícono y color.
2. **Given** la pantalla de categorías, **When** crea una categoría indicando tipo, nombre, ícono y color, **Then** la categoría aparece en la lista y queda disponible de inmediato en el formulario de movimientos, suscripciones e ingresos recurrentes del tipo correspondiente.
3. **Given** una categoría existente, **When** cambia su nombre, ícono o color y guarda, **Then** el cambio se ve en todos los movimientos, reportes y gráficas que la usan, sin alterar los movimientos asignados.
4. **Given** el formulario de categoría, **When** abre el selector de íconos, **Then** ve un catálogo amplio organizado por grupos temáticos y puede buscar por nombre.
5. **Given** el formulario de categoría, **When** elige color, **Then** solo puede escoger de la paleta predefinida, y cada color se ve bien tanto en modo claro como en oscuro.
6. **Given** el formulario, **When** se muestra, **Then** incluye una vista previa de cómo se verá la categoría (ícono sobre su color con el nombre).
7. **Given** que intenta guardar con un nombre vacío o igual (sin distinguir mayúsculas ni tildes ni espacios extremos) al de otra categoría activa del mismo tipo, **When** guarda, **Then** el formulario muestra el error y no guarda.
8. **Given** que crea o edita una categoría sin conexión, **When** recupera la red, **Then** el cambio se sincroniza y aparece en sus otros dispositivos.
9. **Given** el formulario de nuevo movimiento, **When** el usuario toca el chip "+ Nueva" de la lista de categorías, **Then** se abre el editor de categoría con el tipo del movimiento ya fijado, y al guardar vuelve al formulario sin perder lo que llevaba escrito, con la nueva categoría seleccionada.
10. **Given** el editor abierto desde el formulario de movimientos, **When** el usuario cancela, **Then** vuelve al formulario sin cambios.

---

### User Story 5 - Elegir el periodo de la gráfica de patrimonio (Priority: P3)

Como usuario, quiero cambiar el rango de la gráfica de Patrimonio entre 6 meses, 12 meses, 24 meses y "Todo" para ver la evolución de mi patrimonio a corto y largo plazo.

**Why this priority**: mejora una vista existente; útil pero menos urgente.

**Independent Test**: en Patrimonio, alternar entre los cuatro rangos y comprobar que la gráfica muestra la cantidad de meses esperada y los valores coinciden con el patrimonio calculado en cada mes.

**Acceptance Scenarios**:

1. **Given** la pantalla de Patrimonio, **When** se abre, **Then** la gráfica muestra por defecto los últimos 12 meses y un selector con las opciones "6M", "12M", "24M" y "Todo".
2. **Given** el selector, **When** elige 6M o 24M, **Then** la gráfica muestra ese número de meses terminando en el mes en curso y el título de la sección refleja el rango.
3. **Given** el selector, **When** elige "Todo", **Then** la gráfica arranca en el mes del primer dato del usuario (primer movimiento, saldo inicial, CDT o bien registrado) y termina en el mes en curso.
4. **Given** un historial más corto que el rango elegido, **When** se muestra la gráfica, **Then** solo se dibujan los meses con historial, sin meses vacíos en cero al inicio.
5. **Given** un historial de varios años con "Todo", **When** se muestra, **Then** las etiquetas del eje siguen siendo legibles (sin solaparse) en móvil.

---

### Edge Cases

- **Mes con datos solo en otra moneda**: el MVP es solo COP; no aplica.
- **Cambio de mes mientras la app está abierta** (medianoche del último día en America/Bogota): el "mes en curso" y el límite de navegación del selector del Resumen y de las pantallas dedicadas se actualizan; si el usuario estaba viendo el mes en curso pasa al nuevo mes, y si tenía un periodo anterior seleccionado, se conserva.
- **Categoría editada en dos dispositivos**: prevalece la última edición (regla general de sincronización).
- **Categoría creada sin conexión con el mismo nombre que otra creada en otro dispositivo**: al sincronizar, el servidor rechaza el duplicado; la app informa al usuario y le permite renombrar o descartar su cambio local, igual que con otros conflictos de sincronización.
- **Categoría con ícono que no existe en el catálogo nuevo** (p. ej. datos antiguos): se muestra un ícono genérico de respaldo y al editarla el usuario puede elegir uno del catálogo.
- **Categoría con color fuera de la paleta** (datos existentes): se conserva y se muestra tal cual; al editarla el selector no tiene ninguno marcado hasta que elija uno de la paleta.
- **Movimientos de transferencia, pagos de tarjeta y reembolsables**: se excluyen de ingresos, gastos y balance con las mismas reglas que ya aplica "Gastos por categoría" y las tarjetas del Resumen.
- **"Todo" con un único mes de historial**: la gráfica muestra un solo punto (o un estado que lo explique) sin errores.
- **Nombre de categoría muy largo**: se limita a 50 caracteres y se recorta con elipsis donde no quepa.

## Requirements *(mandatory)*

### Functional Requirements

**Meses anteriores y pantallas dedicadas**

- **FR-001**: El Resumen MUST ofrecer un selector de mes que cambie las tarjetas de ingresos, gastos y balance a cualquier mes entre el primer mes con movimientos y el mes en curso. Tiene flechas anterior/siguiente y, al tocar el nombre del mes, una lista de meses agrupada por año para saltar directo a cualquiera. Por defecto muestra el mes en curso, permite volver a él en un toque y no afecta a las demás tarjetas del Resumen.
- **FR-002**: Los totales de ingresos, gastos y balance de un periodo MUST calcularse con las mismas reglas de inclusión y exclusión que ya usan las estadísticas del Resumen y "Gastos por categoría", de modo que un mismo periodo dé el mismo número en todas las vistas.
- **FR-003**: La variación de cada total MUST compararse contra el periodo inmediatamente anterior al seleccionado.
- **FR-004**: El selector del Resumen y las pantallas dedicadas MUST NOT permitir navegar a un periodo posterior al periodo en curso.
- **FR-005**: Las tarjetas del Resumen MUST abrir su pantalla dedicada en el mes seleccionado en el Resumen: ingresos → "Ingresos por categoría"; gastos → "Gastos por categoría"; balance → "Balance". Esto reemplaza el acceso actual de la tarjeta de ingresos a Movimientos filtrados. Las etiquetas de las tarjetas MUST indicar el mes mostrado.
- **FR-006**: Debe existir una pantalla "Ingresos por categoría" con modo mes/año, navegación entre periodos, total, variación, distribución por categoría con porcentaje y variación, acceso a los movimientos de cada categoría y gráfica de evolución de 6 periodos, con el mismo diseño que "Gastos por categoría".
- **FR-007**: Debe existir una pantalla "Balance" con modo mes/año y navegación entre periodos que muestre balance, ingresos, gastos y variación, y una gráfica de evolución de 6 periodos con ingresos, gastos y balance.
- **FR-008**: Las nuevas pantallas MUST ser accesibles desde el menú de secciones de Finanzas y desde las tarjetas correspondientes del Resumen (FR-005).
- **FR-009**: Los meses y años MUST calcularse en la zona horaria America/Bogota.

**Categorías**

- **FR-010**: El menú de secciones de Finanzas MUST incluir la sección "Categorías".
- **FR-011**: La sección MUST listar las categorías activas separadas por tipo (egresos e ingresos), mostrando nombre, ícono y color.
- **FR-012**: El usuario MUST poder crear una categoría indicando tipo (ingreso o egreso), nombre, ícono y color, desde la sección Categorías o desde el chip "+ Nueva" del formulario de movimientos. En este último caso el tipo queda fijado al del movimiento y, al guardar, la categoría queda seleccionada sin perder los datos ya escritos. Los formularios de suscripciones e ingresos recurrentes no ofrecen creación en línea.
- **FR-013**: El usuario MUST poder editar nombre, ícono y color de una categoría existente. El tipo de una categoría existente MUST NOT poder cambiarse, para no reclasificar movimientos ya registrados.
- **FR-014**: El nombre MUST ser obligatorio, de 1 a 50 caracteres tras quitar espacios extremos, y único entre las categorías activas del mismo tipo, sin distinguir mayúsculas ni tildes.
- **FR-015**: El selector de íconos MUST ofrecer al menos 80 íconos organizados en grupos temáticos (p. ej. comida, transporte, hogar, salud, educación, ocio, compras, servicios, finanzas, trabajo, viajes, mascotas, familia) y permitir buscar por nombre en español.
- **FR-016**: El selector de color MUST ofrecer una paleta predefinida de entre 16 y 24 colores vibrantes, legibles en modo claro y oscuro; no se permiten colores libres.
- **FR-017**: El formulario MUST mostrar una vista previa de la categoría con el ícono y color elegidos.
- **FR-018**: Las categorías creadas o editadas MUST guardarse primero en el dispositivo, estar disponibles de inmediato en los formularios y reportes, y sincronizarse cuando haya conexión.
- **FR-019**: Los cambios de nombre, ícono o color MUST reflejarse en todos los lugares donde se muestra la categoría sin modificar los movimientos, suscripciones ni ingresos recurrentes que la usan.

**Patrimonio**

- **FR-020**: La gráfica de Patrimonio MUST ofrecer un selector de rango con las opciones 6 meses, 12 meses, 24 meses y Todo; 12 meses es el valor por defecto.
- **FR-021**: "Todo" MUST abarcar desde el mes del primer dato patrimonial del usuario hasta el mes en curso.
- **FR-022**: Cuando el historial sea más corto que el rango elegido, la gráfica MUST mostrar solo los meses con historial.
- **FR-023**: El título de la sección de la gráfica MUST indicar el rango elegido y las etiquetas del eje MUST seguir siendo legibles en cualquier rango.

### Key Entities

- **Categoría** (existente): nombre, tipo (ingreso/egreso), ícono, color y orden. Esta feature no añade campos; restringe ícono al catálogo ampliado y color a la paleta para las categorías nuevas o editadas.
- **Catálogo de íconos**: lista fija en la app de íconos disponibles para categorías, cada uno con nombre, grupo temático y palabras clave en español para la búsqueda.
- **Paleta de colores de categoría**: lista fija en la app de colores permitidos, definida en el sistema de tema.
- **Periodo**: mes o año seleccionado para un reporte (ya existe en "Gastos por categoría"); se reutiliza en ingresos, balance y en el selector de mes del Resumen.
- **Rango de patrimonio**: 6M, 12M, 24M o Todo; estado de la pantalla, no se guarda.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El usuario puede ver ingresos, gastos y balance del mes anterior en 1 toque desde el Resumen, y cualquier mes con movimientos en 3 toques o menos (nombre del mes → lista → mes elegido).
- **SC-002**: Para cualquier mes, ingresos, gastos y balance coinciden al centavo entre el Resumen, "Ingresos por categoría", "Gastos por categoría" y "Balance".
- **SC-003**: El usuario puede crear una categoría nueva con ícono y color en menos de 30 segundos.
- **SC-004**: Encontrar un ícono con la búsqueda lleva menos de 10 segundos para los conceptos de categoría comunes (mercado, gasolina, salario, arriendo, mascota…).
- **SC-005**: Una categoría creada sin conexión está disponible en el formulario de movimientos al instante y aparece en otro dispositivo tras la siguiente sincronización.
- **SC-006**: Cambiar el periodo de un reporte o el rango de la gráfica de patrimonio actualiza los datos en menos de 1 segundo en un Android de gama media con 2 años de movimientos.
- **SC-007**: Todas las pantallas nuevas funcionan igual en Android y web, en modo claro y oscuro.

## Assumptions

- **Solo cliente**: las categorías ya se sincronizan y el servidor ya valida su unicidad por usuario, nombre y tipo; no se requieren cambios en el servidor ni en el modelo de datos.
- **Sin borrado, archivado ni reordenamiento de categorías**: confirmado por el usuario (Clarifications 2026-10-31); solo se crean y editan. Eliminar, archivar, fusionar o reordenar categorías queda fuera de alcance, y la sección de categorías no ofrece ninguna de esas acciones. Las categorías nuevas se añaden al final de su tipo.
- **Categorías existentes**: no se migran sus íconos ni colores; se siguen mostrando como están hasta que el usuario las edite.
- **Mismas reglas de cálculo**: ingresos, gastos y balance excluyen transferencias, pagos de tarjeta y movimientos reembolsables, como ya lo hacen las vistas actuales.
- **Selección no persistente**: el mes elegido en el Resumen, el periodo de las pantallas dedicadas y el rango de patrimonio no se guardan entre sesiones; al abrir la app se muestran el mes en curso y 12 meses.
- **Ambas vías (opción C)**: por decisión del usuario, se consulta un mes anterior tanto con el selector del Resumen como en las pantallas dedicadas. El selector del Resumen es solo de meses; el modo año existe solo en las pantallas dedicadas.
- **Periodos independientes**: cambiar de periodo dentro de una pantalla dedicada no cambia el mes seleccionado en el Resumen.
- **Evolución en pantallas dedicadas**: ingresos y balance usan 6 periodos de evolución, igual que gastos; los rangos 6M/12M/24M/Todo aplican solo a Patrimonio.
- **Moneda única**: COP, como en el resto del MVP.
