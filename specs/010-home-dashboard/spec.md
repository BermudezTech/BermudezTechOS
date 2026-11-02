# Feature Specification: Dashboard de Inicio (finanzas)

**Feature Branch**: `010-home-dashboard`

**Created**: 2026-11-01

**Status**: Draft

**Input**: User description: "Vamos a trabajar en el dashboard del frontend... Por el momento como el MVP consistió unicamente en las finanzas, quiero los siguientes widgets en el dashboard: Tarjeta de patrimonio neto con su gráfica de los últimos 12 meses, mini-widget de ingresos vs gastos mes actual y balance neto, alerta de próximos vencimientos y suscripciones, botón de acción rápida para registrar movimiento"

## Contexto

Hoy la pestaña **Inicio** solo muestra un saludo con el nombre del usuario y, durante la primera descarga de datos, un aviso de progreso. Toda la información financiera vive en la pestaña Finanzas (Resumen, Patrimonio, Balance, Suscripciones, Inversiones, Cuentas). El usuario quiere que Inicio sea un tablero que responda de un vistazo: ¿cuánto tengo?, ¿cómo voy este mes?, ¿qué se me viene encima?, y que permita registrar un movimiento en pocos toques.

Esta feature es solo de cliente: no cambia el modelo de datos ni el servidor. Todos los valores se calculan con las mismas reglas que ya usan las pantallas de Finanzas, para que los números coincidan exactamente.

## Clarifications

### Session 2026-11-01

- Q: ¿Qué hace el botón de acción rápida? → A: Despliega un menú corto Gasto / Ingreso / Transferencia; la opción elegida abre el formulario de nuevo movimiento con ese tipo preseleccionado.
- Q: ¿Qué entra en "Próximos vencimientos"? → A: Cobros de suscripciones activas, CDTs activos por vencer y fecha de pago de tarjetas de crédito con deuda. Los ingresos recurrentes esperados quedan fuera.
- Q: ¿Cuántos días hacia adelante cubre la alerta? → A: 15 días (hoy incluido), igual que el aviso de CDTs por vencer en Inversiones.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver mi patrimonio neto y su evolución (Priority: P1)

Como usuario, al abrir la app quiero ver mi patrimonio neto actual y una gráfica de cómo ha evolucionado en los últimos 12 meses, para saber si mi situación financiera mejora sin tener que entrar a Finanzas.

**Why this priority**: es la métrica más importante y la que da sentido al tablero; por sí sola ya convierte Inicio en algo útil.

**Independent Test**: con cuentas, CDTs, bienes y deudas registrados en varios meses, abrir Inicio y comprobar que el valor y cada punto de la gráfica coinciden con la pantalla Finanzas → Patrimonio en el rango de 12 meses.

**Acceptance Scenarios**:

1. **Given** datos financieros, **When** el usuario abre Inicio, **Then** ve una tarjeta "Patrimonio neto" con el valor actual y una gráfica de 12 puntos (cierre de cada mes; el mes en curso, a hoy).
2. **Given** la tarjeta, **When** se muestra, **Then** incluye la variación frente al cierre del mes anterior (monto y sentido: sube/baja).
3. **Given** la tarjeta, **When** el usuario la toca, **Then** se abre Finanzas → Patrimonio.
4. **Given** un usuario con menos de 12 meses de historia, **When** se muestra la gráfica, **Then** los meses anteriores a su primer registro aparecen en cero (mismo comportamiento que Patrimonio con 12 meses) sin error.
5. **Given** un patrimonio negativo, **When** se muestra, **Then** el valor aparece con el color de valor negativo del tema.
6. **Given** un usuario sin cuentas, CDTs ni bienes, **When** abre Inicio, **Then** la tarjeta muestra un estado vacío con acceso para crear su primera cuenta, en lugar de una gráfica plana.

---

### User Story 2 - Ver cómo voy este mes (Priority: P1)

Como usuario, quiero un mini-widget con los ingresos y gastos del mes en curso y el balance neto resultante, para saber si este mes estoy gastando más de lo que gano.

**Why this priority**: es la consulta diaria más frecuente; junto con el patrimonio forma el núcleo del tablero.

**Independent Test**: con movimientos en el mes en curso, comprobar que ingresos, gastos y balance coinciden con las tarjetas del mes en curso de Finanzas → Resumen.

**Acceptance Scenarios**:

1. **Given** movimientos en el mes en curso, **When** el usuario abre Inicio, **Then** ve un widget "Este mes · <mes año>" con ingresos, gastos y balance (ingresos − gastos).
2. **Given** el widget, **When** se muestra, **Then** una representación visual compara ingresos frente a gastos (p. ej. dos barras proporcionales).
3. **Given** un balance negativo, **When** se muestra, **Then** aparece con el color de egreso del tema.
4. **Given** el widget, **When** el usuario lo toca, **Then** se abre Finanzas → Balance en el mes en curso.
5. **Given** un mes sin movimientos, **When** se muestra, **Then** los tres valores aparecen en cero, sin error.
6. **Given** que el usuario eligió otro mes en Finanzas → Resumen, **When** vuelve a Inicio, **Then** el widget sigue mostrando el mes en curso.
7. **Given** el cambio de mes (medianoche del último día en Bogotá) con la app abierta, **When** el usuario vuelve a Inicio, **Then** el widget muestra el nuevo mes.

---

### User Story 3 - Registrar un movimiento en un toque (Priority: P2)

Como usuario, quiero un botón de acción rápida en Inicio para registrar un movimiento sin navegar por Finanzas, porque registrar un gasto debe ser instantáneo.

**Why this priority**: es la acción más frecuente de la app; reduce pasos, pero el formulario ya existe y es accesible desde Finanzas.

**Independent Test**: tocar el botón desde Inicio, guardar un gasto y comprobar que al volver Inicio refleja el nuevo gasto en el widget del mes y en el patrimonio.

**Acceptance Scenarios**:

1. **Given** Inicio, **When** se muestra, **Then** hay un botón de acción rápida "Registrar movimiento" siempre visible (también al desplazarse) que no tapa contenido ni el menú de navegación.
2. **Given** el botón, **When** el usuario lo toca, **Then** se despliega un menú corto con tres opciones (Gasto, Ingreso, Transferencia); al elegir una, se abre el formulario de nuevo movimiento con ese tipo preseleccionado.
3. **Given** el menú desplegado, **When** el usuario toca fuera, el botón de nuevo o el gesto/botón atrás, **Then** el menú se cierra sin abrir el formulario.
4. **Given** el formulario abierto desde Inicio, **When** el usuario guarda o cancela, **Then** vuelve a Inicio y los widgets ya reflejan el cambio, sin recargar manualmente.
5. **Given** un usuario sin cuentas, **When** toca el botón, **Then** se le indica que primero debe crear una cuenta, con acceso a hacerlo (mismo comportamiento que el formulario actual).
6. **Given** sin conexión, **When** registra un movimiento, **Then** se guarda localmente al instante y se sincroniza después.

---

### User Story 4 - Enterarme de lo que se viene (Priority: P2)

Como usuario, quiero una alerta en Inicio con mis próximos vencimientos y cobros de suscripciones, ordenados por fecha, para no llevarme sorpresas y tener la plata lista.

**Why this priority**: aporta valor preventivo, pero depende de que el usuario tenga suscripciones, CDTs o tarjetas registrados.

**Independent Test**: con suscripciones activas, un CDT que vence pronto y una tarjeta de crédito con día de pago y deuda, comprobar que aparecen en orden de fecha con días restantes y monto correctos.

**Acceptance Scenarios**:

1. **Given** elementos próximos, **When** el usuario abre Inicio, **Then** ve un widget "Próximos vencimientos" con una lista ordenada por fecha (la más cercana primero); cada fila muestra ícono del tipo, nombre, fecha, días restantes ("Hoy", "Mañana", "En 5 días") y monto.
2. **Given** los tipos de elemento, **When** se construye la lista, **Then** incluye exactamente tres tipos: cobros de suscripciones activas, CDTs activos por vencer y pagos de tarjetas de crédito con deuda; los ingresos recurrentes no aparecen.
3. **Given** la ventana de tiempo, **When** se filtran los elementos, **Then** solo aparecen los que ocurren entre hoy y hoy + 15 días, ambos inclusive (más los CDTs activos ya vencidos, ver escenario 5).
4. **Given** una suscripción activa, **When** aparece, **Then** el monto es el de su cobro y la fecha su próximo cobro (anual o mensual).
5. **Given** un CDT activo por vencer, **When** aparece, **Then** muestra el valor esperado al vencimiento; si su vencimiento ya pasó y sigue activo (no se ha renovado ni marcado como vencido/cobrado), aparece como "Vencido" al inicio de la lista.
6. **Given** una tarjeta de crédito con día de pago configurado y deuda mayor que cero, **When** aparece, **Then** la fecha es el próximo día de pago (ajustado al último día del mes si el mes es más corto) y el monto la deuda actual; si no tiene deuda o no tiene día de pago, no aparece.
7. **Given** más de 5 elementos, **When** se muestra el widget, **Then** se ven los 5 más cercanos y un enlace "Ver todos (N)" que despliega el resto.
8. **Given** una fila, **When** el usuario la toca, **Then** se abre el detalle correspondiente (suscripción, CDT o cuenta).
9. **Given** elementos que vencen hoy o mañana, **When** se muestran, **Then** se destacan visualmente como urgentes.
10. **Given** ningún elemento en la ventana, **When** se muestra el widget, **Then** aparece un estado vacío discreto ("Nada por vencer en los próximos 15 días") que no ocupa más que una línea de contenido.
11. **Given** una suscripción pausada o cancelada, un CDT renovado, vencido o cancelado, o una cuenta archivada o borrada, **When** se construye la lista, **Then** no aparecen.

---

### User Story 5 - Tablero ordenado, adaptable y preparado para otros módulos (Priority: P3)

Como usuario, quiero que el tablero se vea bien en el teléfono y en pantallas anchas, conserve el saludo y respete mis preferencias de privacidad y tema; y como producto, que futuros módulos (rutinas, hábitos…) puedan agregar sus widgets sin rehacer Inicio.

**Why this priority**: es calidad transversal; las historias anteriores ya aportan valor sin ella, pero sin ella el tablero no escala.

**Independent Test**: abrir Inicio en un teléfono y en una ventana ≥ 1024 px de ancho, en modo claro y oscuro, con y sin ocultar montos; agregar un widget de prueba al registro y verificar que aparece sin tocar la pantalla de Inicio.

**Acceptance Scenarios**:

1. **Given** Inicio, **When** se abre, **Then** arriba se mantiene el saludo con el nombre del usuario (en tamaño compacto, no centrado a pantalla completa) y, durante la primera descarga, el aviso de progreso actual.
2. **Given** un teléfono (< 1024 px), **When** se muestra el tablero, **Then** los widgets se apilan en una columna en este orden: Patrimonio, Este mes, Próximos vencimientos.
3. **Given** una pantalla ≥ 1024 px, **When** se muestra el tablero, **Then** los widgets se acomodan en cuadrícula (Patrimonio a ancho completo; Este mes y Próximos vencimientos lado a lado).
4. **Given** que el usuario ocultó los montos en Finanzas, **When** abre Inicio, **Then** todos los montos del tablero aparecen ocultos; y hay un control en Inicio para mostrarlos u ocultarlos que comparte la misma preferencia.
5. **Given** modo claro u oscuro, **When** se muestra el tablero, **Then** todos los widgets usan los colores del tema con contraste legible.
6. **Given** la primera descarga en curso sin datos locales, **When** se muestra el tablero, **Then** los widgets muestran un estado de carga o vacío, nunca valores engañosos presentados como definitivos.
7. **Given** un módulo que registra un widget nuevo, **When** se abre Inicio, **Then** el widget aparece en la posición que declara, sin modificar la pantalla de Inicio; los módulos "próximamente" no aportan widgets.

---

### Edge Cases

- Usuario recién registrado sin ningún dato: el saludo, el botón de acción rápida y estados vacíos útiles en cada widget (sin gráficas planas ni ceros engañosos en patrimonio).
- Datos cambian mientras Inicio está abierto (sync en segundo plano o movimiento guardado): los widgets se actualizan solos.
- Cambio de día/mes con la app abierta: "Hoy/Mañana", la ventana de vencimientos y el mes del widget se recalculan con la fecha de Bogotá, no la del dispositivo.
- Dispositivo con zona horaria distinta a Bogotá: fechas y meses siguen calculándose en America/Bogota.
- Suscripción con día de cobro 31 en un mes de 30 días o febrero: la fecha se ajusta al último día del mes.
- Suscripción cuya fecha de inicio es futura: su primer cobro cuenta desde la fecha de inicio.
- Varios elementos el mismo día: se ordenan por tipo (tarjetas, CDTs, suscripciones) y luego por nombre, de forma estable.
- Cuentas o CDTs excluidos del patrimonio: siguen apareciendo en vencimientos (la exclusión afecta solo al patrimonio).
- Montos muy grandes (p. ej. miles de millones): se muestran completos o abreviados sin desbordar la tarjeta.
- Muchos meses de historia o miles de movimientos: Inicio abre fluido en Android de gama media.

## Requirements *(mandatory)*

### Functional Requirements

**Estructura del tablero**

- **FR-001**: Inicio MUST mostrar, de arriba abajo: saludo compacto con el nombre del usuario, aviso de primera descarga (solo mientras dure), y los widgets del tablero.
- **FR-002**: Los widgets MUST provenir de un registro de widgets por módulo, donde cada módulo activo declara sus widgets con identificador, orden y ancho preferido (completo o medio); Inicio MUST renderizar lo que haya en el registro sin conocer cada widget.
- **FR-003**: En pantallas < 1024 px los widgets MUST apilarse en una columna; en ≥ 1024 px MUST distribuirse en cuadrícula respetando el ancho preferido de cada uno.
- **FR-004**: Todos los datos del tablero MUST leerse de la base local del dispositivo, sin esperar la red, y actualizarse automáticamente cuando cambian los datos locales.
- **FR-005**: El tablero MUST respetar la preferencia de mostrar/ocultar montos ya existente en Finanzas y ofrecer en Inicio un control que la cambie.
- **FR-006**: Fechas, días restantes y meses MUST calcularse en America/Bogota.

**Patrimonio neto**

- **FR-007**: El widget de patrimonio MUST mostrar el patrimonio neto actual calculado con las mismas reglas que Finanzas → Patrimonio.
- **FR-008**: MUST mostrar una gráfica de 12 puntos con el patrimonio al cierre de cada uno de los últimos 12 meses (el actual, a hoy), idéntica en valores a la vista de 12 meses de Patrimonio.
- **FR-009**: MUST mostrar la variación del patrimonio frente al cierre del mes anterior.
- **FR-010**: Tocar el widget MUST abrir Finanzas → Patrimonio.
- **FR-011**: Sin cuentas, CDTs ni bienes, el widget MUST mostrar un estado vacío con acceso a crear una cuenta.

**Mes en curso**

- **FR-012**: El widget del mes MUST mostrar ingresos, gastos y balance (ingresos − gastos) del mes en curso con las mismas reglas que Finanzas → Balance (incluidas las reglas existentes sobre transferencias y reembolsos).
- **FR-013**: MUST incluir una comparación visual proporcional entre ingresos y gastos.
- **FR-014**: El widget MUST mostrar siempre el mes en curso, independiente del mes elegido en Finanzas → Resumen.
- **FR-015**: Tocar el widget MUST abrir Finanzas → Balance en el mes en curso.

**Próximos vencimientos**

- **FR-016**: El widget MUST listar los elementos próximos (suscripciones activas, CDTs activos y pagos de tarjetas con deuda) que ocurran entre hoy y hoy + 15 días inclusive, más los CDTs activos cuya fecha de vencimiento ya pasó.
- **FR-017**: Cada elemento MUST mostrar tipo, nombre, fecha, días restantes en lenguaje natural y monto; los de hoy y mañana MUST destacarse como urgentes.
- **FR-018**: La lista MUST ordenarse por fecha ascendente (vencidos primero) con desempate estable por tipo y nombre.
- **FR-019**: MUST mostrar como máximo 5 elementos y un control "Ver todos (N)" cuando haya más.
- **FR-020**: Tocar un elemento MUST abrir su detalle (suscripción, CDT o cuenta de tarjeta).
- **FR-021**: Sin elementos en la ventana, el widget MUST mostrar un estado vacío discreto de una línea.
- **FR-022**: MUST excluir suscripciones pausadas/canceladas, CDTs no activos (renovados, vencidos o cancelados), tarjetas sin deuda o sin día de pago, y registros archivados o borrados.

**Acción rápida**

- **FR-023**: Inicio MUST mostrar un botón flotante de acción rápida para registrar un movimiento, visible al desplazarse, sin tapar el menú de navegación ni el último widget.
- **FR-024**: El botón MUST desplegar un menú Gasto / Ingreso / Transferencia; cada opción MUST abrir el formulario de nuevo movimiento existente con ese tipo preseleccionado y, al guardar o cancelar, volver a Inicio.
- **FR-025**: El botón MUST tener etiqueta accesible ("Registrar movimiento") y área táctil de al menos 48 × 48 dp.

**Calidad**

- **FR-026**: Los widgets MUST usar la estética liquid glass y los tokens del tema existentes en modo claro y oscuro, limitando capas de desenfoque para mantener fluidez en Android de gama media.
- **FR-027**: El cálculo de la lista de vencimientos (filtrado, fechas, orden, montos) MUST tener pruebas automatizadas.
- **FR-028**: Finanzas → Resumen MUST seguir funcionando igual; esta feature no elimina ni cambia sus tarjetas.

### Key Entities

- **Widget del tablero**: unidad visual que aporta un módulo a Inicio; tiene identificador, módulo dueño, orden y ancho preferido (completo/medio).
- **Elemento próximo**: vista derivada (no se almacena) de algo que ocurrirá pronto: tipo (suscripción, CDT, pago de tarjeta), referencia al registro de origen, nombre, fecha, días restantes, monto y moneda, y si es urgente o vencido.
- **Punto de patrimonio** y **totales del mes**: derivados existentes de Patrimonio y Balance; esta feature los reutiliza sin redefinirlos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Al abrir la app, el usuario ve su patrimonio, el balance del mes y sus próximos vencimientos sin ninguna interacción adicional, en menos de 1 segundo tras el saludo en un Android de gama media con 2 años de datos.
- **SC-002**: Registrar un gasto desde Inicio requiere como máximo 2 toques para llegar al formulario con el tipo ya elegido y el tablero refleja el cambio inmediatamente al volver.
- **SC-003**: El 100 % de los valores del tablero (patrimonio, 12 puntos de la gráfica, ingresos, gastos, balance) coinciden al centavo con las pantallas correspondientes de Finanzas.
- **SC-004**: El 100 % de los elementos próximos dentro de la ventana aparecen, con fecha y días restantes correctos en Bogotá, incluidos fines de mes cortos y años bisiestos.
- **SC-005**: Agregar un widget de un módulo nuevo al tablero no requiere modificar la pantalla de Inicio.
- **SC-006**: El tablero funciona completo sin conexión.

## Assumptions

- La feature es solo de cliente; no se agregan tablas, columnas ni endpoints.
- La moneda es COP (única en el MVP); los montos se muestran con el formato existente.
- "Mes en curso" y "hoy" se determinan en America/Bogota.
- La ventana de 15 días coincide con el criterio de "CDT por vencer" de Inversiones; si en el futuro se cambia uno, se revisa el otro para mantenerlos coherentes.
- El monto de una tarjeta de crédito en vencimientos es su deuda total actual (la app no maneja aún extractos con "pago mínimo" ni "pago total del periodo").
- El monto de un CDT en vencimientos es su valor neto esperado al vencimiento, como en su detalle.
- La pestaña Finanzas → Resumen conserva sus tarjetas; algunas cifras quedarán duplicadas a propósito entre Inicio y Finanzas.
- No se permite al usuario reordenar, ocultar ni configurar widgets en esta versión.
- No se envían notificaciones push ni recordatorios; la alerta es solo visual dentro de Inicio.
