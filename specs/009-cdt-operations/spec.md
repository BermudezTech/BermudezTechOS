# Feature Specification: Operaciones de CDT (borrar, alta sin histórico, vencimiento comercial y renovación)

**Feature Branch**: `009-cdt-operations`

**Created**: 2026-11-01

**Status**: Draft

**Input**: User description: "Poder borrar un CDT creado. Crear un CDT sin asociarlo a movimientos (CDTs sin histórico); los CDTs nuevos sí nacen de una transferencia desde otra cuenta. Calcular bien la fecha de vencimiento con días comerciales (función `helpComercialDays` adjunta). Al renovar: agregar capital, retirar capital o solo renovar (capital + intereses se quedan en el CDT). No permitir renovar hasta que haya llegado el vencimiento. No calcular interés causado a la fecha; solo el valor neto esperado al vencimiento. Los formularios de creación y renovación permiten editar el valor inicial y el valor final del periodo (cálculo automático editable ante discrepancias con el banco). La tasa nominal no la ingresa el usuario: se calcula primero desde la TEA y luego desde el valor final real indicado por el banco."

## Contexto

La app ya permite registrar CDTs (spec 001, §10): cada CDT crea una cuenta de inversión, una transferencia de apertura desde una cuenta de origen y muestra interés causado, valor actual estimado y valor neto al vencimiento. Hoy:

- No se puede borrar un CDT.
- Siempre se exige una cuenta de origen y se crea la transferencia de apertura, lo que obliga a inventar movimientos para CDTs que el usuario ya tenía antes de usar la app.
- La fecha de vencimiento se calcula sumando días calendario (apertura + plazo), lo que no coincide con lo que hacen los bancos (días comerciales de 30 por mes).
- El usuario debe digitar la tasa nominal, y el valor final no se puede ajustar al que reporta el banco.
- Los botones "Registrar vencimiento" y "Renovar" están deshabilitados.

## Clarifications

### Session 2026-11-01

- Q: Aperturas a fin de mes (día 29–31) → A: replicar la función `helpComercialDays` tal cual (así operan los bancos); 2026-01-31 + 30 → 2026-03-03.
- Q: ¿Se puede renovar el mismo día del vencimiento? → A: sí, desde el día del vencimiento inclusive.
- Q: Base anual del cálculo de interés → A: 360 días comerciales.
- Q: ¿Cómo se calcula la tasa nominal a partir de la TEA? → A: siempre como nominal con pago al vencimiento: ((1 + TEA)^(plazo/360) − 1) × 360/plazo, sin importar la modalidad de pago.
- Q: ¿Se incluye liquidar (retirar todo y cerrar) un CDT vencido sin renovarlo? → A: no; queda para una spec posterior.
- Q: ¿Cómo se registra la retención en la fuente al renovar? → A: un solo ingreso por el interés neto; además, el interés bruto y el monto de retención del periodo se guardan como datos independientes para futuros cálculos de impuestos.
- Q: Al borrar un CDT, ¿se borran sus movimientos y su cuenta de inversión? → A: sí, se borra todo (CDT, cuenta de inversión, movimientos y datos de interés/retención liquidados) y los saldos se restauran.
- Q: ¿La cuenta destino al vencer puede quedar vacía? → A: sí; es opcional al crear y al renovar, y "Solo renovar" no requiere ninguna cuenta.

### Session 2026-11-02

- Q: Al renovar, si el capital que reporta el banco no coincide con valor final ± aporte/retiro, ¿cómo se registra la diferencia? → A: con un movimiento de ajuste propio (ingreso o egreso) en la fecha de inicio del nuevo periodo. El cierre del periodo anterior y sus movimientos nunca se modifican.
- Q: ¿Qué muestra el historial? → A: por cada periodo, capital, interés bruto, retención, interés neto y valor final (liquidado en periodos renovados). Cada periodo se puede abrir para ver su detalle.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fecha de vencimiento en días comerciales (Priority: P1)

Como usuario, al ingresar la fecha de apertura y el plazo en días de un CDT, la app calcula la fecha de vencimiento igual que el banco: cada bloque de 30 días equivale a un mes calendario completo y los días sobrantes se suman como días calendario.

**Why this priority**: es un error actual que afecta a todos los CDTs (crear, renovar, indicadores de "próximo a vencer" y la regla de cuándo se puede renovar). Todo lo demás depende de una fecha de vencimiento correcta.

**Independent Test**: crear CDTs con distintas fechas y plazos y comparar la fecha propuesta con la tabla de ejemplos de FR-001.

**Acceptance Scenarios**:

1. **Given** el formulario de CDT, **When** el usuario ingresa apertura 2026-01-15 y plazo 90 días, **Then** el vencimiento propuesto es 2026-04-15.
2. **Given** el formulario de CDT, **When** el usuario ingresa apertura 2026-11-01 y plazo 180 días, **Then** el vencimiento propuesto es 2027-05-01 (el cálculo cruza de año correctamente).
3. **Given** el formulario de CDT, **When** el usuario ingresa apertura 2026-01-15 y plazo 45 días, **Then** el vencimiento propuesto es 2026-03-02 (un mes comercial + 15 días calendario).
4. **Given** un vencimiento propuesto, **When** el usuario lo edita manualmente, **Then** se respeta la fecha editada (debe seguir siendo posterior a la apertura).

---

### User Story 2 - Registrar un CDT existente sin histórico (Priority: P1)

Como usuario que empieza a usar la app con CDTs ya abiertos en el banco, quiero registrarlos sin tener que asociarlos a una transferencia desde otra cuenta, para que mi patrimonio refleje el CDT sin alterar los saldos de mis otras cuentas.

**Why this priority**: sin esto el usuario no puede cargar su situación real o tiene que inventar movimientos que descuadran sus cuentas.

**Independent Test**: crear un CDT marcándolo como "existente / sin movimiento de origen" y verificar que la cuenta de inversión muestra el capital y que ninguna otra cuenta cambió de saldo.

**Acceptance Scenarios**:

1. **Given** el formulario de nuevo CDT, **When** el usuario elige el origen "Transferencia desde una cuenta" y una cuenta de activo, **Then** se crea el CDT con una transferencia de apertura desde esa cuenta por el valor del capital, como hoy.
2. **Given** el formulario de nuevo CDT, **When** el usuario elige el origen "CDT existente (sin movimiento)", **Then** no se pide cuenta de origen, se crea el CDT y su cuenta de inversión arranca con el capital como saldo inicial, sin generar ningún movimiento.
3. **Given** un CDT existente registrado con una fecha de apertura en el pasado, **When** se guarda, **Then** el patrimonio neto incluye el capital del CDT y los saldos de las demás cuentas no cambian.
4. **Given** un CDT existente cuya fecha de vencimiento ya llegó, **When** se guarda, **Then** queda disponible para renovarse (User Story 5).

---

### User Story 3 - Valores inicial y final editables y tasa nominal calculada (Priority: P1)

Como usuario, en los formularios de creación y renovación ingreso capital, TEA, plazo y retención; la app calcula automáticamente el valor neto esperado al vencimiento y la tasa nominal. Si el banco me reporta un valor distinto, puedo editar el valor inicial o el valor final, y la tasa nominal se recalcula a partir del valor final real.

**Why this priority**: el valor neto al vencimiento es la única cifra que el usuario necesita seguir, y debe coincidir con la del banco al centavo.

**Independent Test**: crear un CDT, observar el valor final y la tasa nominal calculados, sobrescribir el valor final con el valor del banco y verificar que se guarda ese valor y que la tasa nominal cambia en consecuencia.

**Acceptance Scenarios**:

1. **Given** el formulario, **When** el usuario ingresa capital, TEA, plazo y retención, **Then** la app muestra el valor neto esperado al vencimiento y la tasa nominal calculados, sin pedir la tasa nominal.
2. **Given** el valor final calculado, **When** el usuario lo edita con el valor del banco, **Then** se guarda el valor editado, la tasa nominal se recalcula con base en ese valor y la TEA se conserva como la ingresó el usuario.
3. **Given** el valor final editado manualmente, **When** el usuario cambia después capital, TEA, plazo o retención, **Then** la app avisa que el valor final fue ajustado a mano y ofrece recalcularlo; no lo sobrescribe sin confirmación.
4. **Given** el valor inicial (capital) calculado en una renovación, **When** el usuario lo edita con el valor que reporta el banco, **Then** se guarda el valor editado, la diferencia con valor final ± aporte/retiro se registra como un movimiento de ajuste, y el valor final y la tasa nominal del nuevo periodo se recalculan a partir de él (salvo que el valor final también se haya editado a mano). El periodo anterior no cambia.
5. **Given** el detalle de un CDT, **When** el usuario lo abre, **Then** ve el valor neto esperado al vencimiento y no ve "interés causado a la fecha" ni "valor actual estimado".

---

### User Story 4 - Borrar un CDT (Priority: P2)

Como usuario, quiero borrar un CDT que registré por error o que ya no quiero seguir, de forma que desaparezca junto con todo lo que la app generó por él.

**Why this priority**: corrige errores de captura; hoy un CDT mal creado no se puede quitar.

**Independent Test**: crear un CDT con transferencia de apertura, borrarlo y verificar que desaparece de la lista, que su transferencia de apertura ya no existe y que el saldo de la cuenta de origen vuelve al valor anterior.

**Acceptance Scenarios**:

1. **Given** el detalle de un CDT, **When** el usuario elige "Borrar" y confirma, **Then** el CDT, su cuenta de inversión y todos los movimientos asociados a él (apertura, intereses, aportes y retiros) se eliminan, y los saldos de las cuentas afectadas se recalculan.
2. **Given** el diálogo de confirmación, **When** el usuario cancela, **Then** no se borra nada.
3. **Given** el diálogo de confirmación, **When** se muestra, **Then** indica cuántos movimientos asociados se borrarán.
4. **Given** un CDT que es la renovación más reciente de otro, **When** el usuario lo borra, **Then** se deshace la renovación: se eliminan los movimientos generados por ella y el CDT anterior vuelve a quedar vencido y pendiente de renovar.
5. **Given** un CDT que ya fue renovado (tiene un CDT posterior en su cadena), **When** el usuario intenta borrarlo, **Then** la app no lo permite y explica que primero debe borrar la renovación más reciente.
6. **Given** un CDT borrado en un dispositivo, **When** se sincroniza, **Then** el borrado se refleja en los demás dispositivos del usuario.

---

### User Story 5 - Renovar un CDT al vencimiento (Priority: P2)

Como usuario, cuando un CDT llega a su fecha de vencimiento, quiero renovarlo eligiendo una de tres operaciones: solo renovar (capital + intereses netos se quedan en el CDT), agregar capital desde otra cuenta o retirar parte del capital hacia otra cuenta, y definir las condiciones del nuevo periodo.

**Why this priority**: es la operación periódica natural de un CDT; hoy está deshabilitada.

**Independent Test**: tomar un CDT vencido, renovarlo con cada una de las tres operaciones y verificar el capital del nuevo periodo, los movimientos generados y los saldos de las cuentas.

**Acceptance Scenarios**:

1. **Given** un CDT activo cuya fecha de vencimiento es posterior a hoy, **When** el usuario abre su detalle, **Then** la acción "Renovar" está deshabilitada e indica la fecha a partir de la cual estará disponible.
2. **Given** un CDT cuya fecha de vencimiento es hoy o ya pasó, **When** el usuario elige "Renovar", **Then** ve el formulario de renovación con: valor final del periodo que termina (editable, prellenado con el valor neto esperado), operación, nueva TEA, nuevo plazo, retención, fecha de inicio del nuevo periodo (por defecto la fecha de vencimiento anterior) y vencimiento calculado con días comerciales.
3. **Given** la operación "Solo renovar", **When** el usuario confirma, **Then** el capital del nuevo periodo es igual al valor final del periodo anterior, se registra el interés neto del periodo anterior como ingreso en la cuenta del CDT, el CDT anterior queda "Renovado" y el nuevo queda "Activo" enlazado al anterior.
4. **Given** la operación "Agregar capital" con un monto y una cuenta de origen de activo, **When** el usuario confirma, **Then** además se registra una transferencia de esa cuenta hacia el CDT por el monto, y el capital del nuevo periodo es valor final + aporte.
5. **Given** la operación "Retirar capital" con un monto y una cuenta destino de activo, **When** el usuario confirma, **Then** además se registra una transferencia del CDT hacia esa cuenta por el monto, y el capital del nuevo periodo es valor final − retiro.
6. **Given** la operación "Retirar capital", **When** el monto es mayor o igual al valor final del periodo anterior, **Then** la app no permite confirmar e indica que el nuevo capital debe ser mayor que cero.
7. **Given** una renovación confirmada, **When** el usuario consulta el historial del CDT, **Then** ve los periodos anteriores con su capital, TEA, fechas y valor final.

---

### Edge Cases

- **Plazos que no son múltiplos de 30**: los días sobrantes tras los meses completos se suman como días calendario (2026-01-15 + 45 días → 2026-03-02).
- **Aperturas a fin de mes (día 29–31)**: se replica la regla de la función adjunta tal cual, que es como operan los bancos: 2026-01-31 + 30 días → 2026-03-03 y 2026-03-31 + 30 días → 2026-05-01. No se ajusta al último día del mes.
- **Plazos largos**: la función adjunta solo contempla 24 meses desde el año de apertura; la regla debe funcionar para cualquier plazo permitido (hasta 3650 días) y cruzar varios años, incluidos años bisiestos.
- **Día exacto de vencimiento**: la renovación está disponible desde el mismo día del vencimiento (inclusive).
- **Fecha de "hoy"**: la comparación con la fecha de vencimiento usa la fecha local de America/Bogota, no la del dispositivo.
- **CDTs creados antes de esta feature**: conservan la fecha de vencimiento guardada; no se recalculan automáticamente. El usuario puede corregirla editando el CDT.
- **Valor final menor que el capital**: se rechaza (un CDT no puede terminar con pérdida); la tasa nominal no puede quedar negativa.
- **Retención cero**: el valor neto es igual al bruto.
- **Borrado sin conexión**: el borrado funciona offline y se sincroniza después; si otro dispositivo modificó el CDT, gana el cambio más reciente.
- **CDT con pago periódico de intereses** (mensual, trimestral…): el registro de cada pago periódico queda fuera de alcance; el valor final se calcula como si los intereses se pagaran al vencimiento.
- **Conflicto de renovación offline**: si el CDT se renueva en dos dispositivos sin conexión, prevalece la última modificación sincronizada; el usuario puede borrar la renovación sobrante (User Story 4, escenario 4).

## Requirements *(mandatory)*

### Functional Requirements

**Fecha de vencimiento**

- **FR-001**: El sistema MUST proponer la fecha de vencimiento con días comerciales: con `m = ⌊plazo / 30⌋` y `r = plazo − 30·m`, vencimiento = apertura + plazo + Σ (días del mes calendario − 30) para los `m` meses consecutivos que comienzan en el mes de apertura. Equivale a avanzar `m` meses calendario y luego `r` días calendario. Ejemplos de referencia (salida de la función `helpComercialDays` del usuario):

  | Apertura   | Plazo | Vencimiento |
  |------------|-------|-------------|
  | 2026-01-15 | 90    | 2026-04-15  |
  | 2026-11-01 | 180   | 2027-05-01  |
  | 2026-02-10 | 360   | 2027-02-10  |
  | 2026-01-15 | 45    | 2026-03-02  |
  | 2026-12-15 | 30    | 2027-01-15  |
  | 2028-01-15 | 60    | 2028-03-15  |
  | 2026-01-31 | 30    | 2026-03-03  |
  | 2026-03-31 | 30    | 2026-05-01  |

- **FR-002**: La regla de FR-001 MUST aplicarse a cualquier plazo entre 1 y 3650 días y a cualquier año (incluidos bisiestos y cruces de varios años).
- **FR-003**: La fecha de vencimiento propuesta MUST poder editarse; la editada debe ser posterior a la fecha de apertura.

**Alta de CDT**

- **FR-004**: El formulario de nuevo CDT MUST ofrecer dos orígenes del dinero: "Transferencia desde una cuenta" (requiere cuenta de activo; genera la transferencia de apertura) y "CDT existente (sin movimiento)" (no pide cuenta; no genera movimientos).
- **FR-005**: Un CDT existente sin movimiento MUST reflejar su capital como saldo inicial de su cuenta de inversión, de modo que cuente en el patrimonio sin modificar otras cuentas.
- **FR-006**: El formulario MUST permitir fechas de apertura en el pasado para ambos orígenes.

**Valores y tasas**

- **FR-007**: Los formularios de creación y renovación MUST pedir capital (valor inicial), TEA, plazo y retención, y MUST NOT pedir la tasa nominal.
- **FR-008**: El sistema MUST calcular el valor neto esperado al vencimiento como capital + interés bruto × (1 − retención), donde interés bruto = capital × ((1 + TEA)^(plazo/360) − 1), con base anual de 360 días comerciales (consistente con el plazo en días comerciales).
- **FR-009**: El usuario MUST poder editar el valor inicial y el valor final del periodo; los valores editados MUST guardarse tal cual (al centavo) y prevalecer sobre los calculados.
- **FR-010**: La tasa nominal MUST calcularse automáticamente como tasa nominal anual con pago al vencimiento, sin importar la modalidad de pago de intereses: (a) desde la TEA: nominal = ((1 + TEA)^(plazo/360) − 1) × 360/plazo; (b) cuando el valor final se edita: nominal = (interés bruto implícito ÷ capital) × 360/plazo, con interés bruto implícito = (valor final − capital) ÷ (1 − retención). La TEA ingresada no se modifica.
- **FR-011**: Si el usuario cambia capital, TEA, plazo o retención después de editar el valor final a mano, el sistema MUST avisarlo y ofrecer recalcular, sin sobrescribir el valor editado sin confirmación.
- **FR-012**: El sistema MUST rechazar un valor final menor que el capital.
- **FR-013**: El detalle y la lista de CDTs MUST mostrar el valor neto esperado al vencimiento y MUST NOT mostrar interés causado a la fecha ni valor actual estimado. El patrimonio neto MUST valorar cada CDT activo por su capital.

**Borrado**

- **FR-014**: Los usuarios MUST poder borrar un CDT desde su detalle, previa confirmación que indique cuántos movimientos asociados se eliminarán.
- **FR-015**: Borrar un CDT MUST eliminar (borrado lógico, sincronizable) el CDT, su cuenta de inversión si ningún otro CDT la usa, todos los movimientos generados por él y los datos de interés bruto, retención e interés neto liquidados (FR-019a); los saldos se recalculan a partir de los movimientos restantes.
- **FR-016**: Solo el CDT más reciente de una cadena de renovaciones MUST poder borrarse; borrar una renovación MUST devolver el CDT anterior al estado vencido pendiente de renovar y eliminar los movimientos de esa renovación (interés del periodo anterior, aporte o retiro).

**Renovación**

- **FR-017**: La acción "Renovar" MUST estar deshabilitada mientras la fecha de hoy (America/Bogota) sea anterior a la fecha de vencimiento; mientras esté deshabilitada MUST indicar la fecha desde la cual estará disponible. Desde el día del vencimiento (inclusive) MUST estar habilitada.
- **FR-018**: El formulario de renovación MUST ofrecer tres operaciones excluyentes: "Solo renovar", "Agregar capital" (monto > 0 y cuenta de origen de activo) y "Retirar capital" (monto > 0, menor que el valor final, y cuenta destino de activo).
- **FR-018a**: La "cuenta destino al vencer" del CDT MUST ser opcional al crear y al renovar. "Solo renovar" MUST poder confirmarse sin ninguna cuenta de origen ni destino. En "Retirar capital", si el CDT tiene cuenta destino definida, MUST proponerse como cuenta destino del retiro (editable); si no la tiene, el usuario MUST elegir una para ese retiro.
- **FR-019**: Al confirmar la renovación, el sistema MUST, en una sola operación atómica: (a) registrar como ingreso en la cuenta del CDT el interés neto del periodo que termina (valor final − capital), fechado en el vencimiento; (b) registrar la transferencia de aporte o retiro, si aplica, fechada en el inicio del nuevo periodo; (c) marcar el CDT anterior como "Renovado"; (d) crear el nuevo periodo como "Activo", enlazado al anterior, con capital = valor final ± aporte/retiro (editable según FR-009); (e) si el capital editado difiere de valor final ± aporte/retiro, registrar la diferencia como un movimiento de ajuste (ingreso si es positiva, egreso si es negativa) en la cuenta del CDT, fechado en el inicio del nuevo periodo. La renovación MUST NOT modificar los movimientos existentes ni el valor esperado del periodo anterior; su resultado real queda solo en la liquidación (FR-019a).
- **FR-019a**: Al cerrar un periodo (renovación), el sistema MUST guardar de forma independiente y sincronizable, asociados a ese periodo y a su fecha de vencimiento: interés bruto, monto de retención en la fuente (en dinero, al centavo) e interés neto, tal que bruto − retención = neto. Si el valor final fue editado, bruto = neto ÷ (1 − tasa de retención) y retención = bruto − neto, redondeados al centavo. Estos datos MUST NOT generar movimientos adicionales; quedan disponibles para el cálculo de impuestos de specs posteriores.
- **FR-020**: El nuevo periodo MUST mantenerse en la misma cuenta de inversión que el anterior, para que el saldo del CDT sea continuo a lo largo de las renovaciones.
- **FR-021**: La fecha de inicio del nuevo periodo MUST ser por defecto la fecha de vencimiento anterior, y su vencimiento se calcula con FR-001.
- **FR-022**: El detalle del CDT MUST mostrar el historial de periodos de su cadena con, por periodo: apertura, vencimiento, TEA, plazo, capital, interés bruto, retención, interés neto y valor final (los liquidados en periodos renovados, los esperados en el vigente). Cada periodo MUST poder abrirse para ver su detalle.

**General**

- **FR-023**: Todas las operaciones (crear, borrar, renovar) MUST funcionar sin conexión y sincronizarse después, con montos exactos al centavo.

### Key Entities

- **CDT (periodo)**: un periodo de inversión con entidad, número de título, capital (valor inicial), TEA, tasa nominal (derivada), plazo en días comerciales, fecha de apertura, fecha de vencimiento, retención, valor neto esperado al vencimiento (calculado o editado, con marca de si fue ajustado a mano), y, al cerrarse el periodo, interés bruto, retención en la fuente e interés neto liquidados, origen del dinero (transferencia o existente sin movimiento), cuenta destino al vencer (opcional), estado (Activo, Renovado, …) y periodo anterior si es una renovación.
- **Cuenta de inversión del CDT**: cuenta de activo que acumula el saldo del CDT a lo largo de todos sus periodos; saldo inicial igual al capital solo en CDTs existentes sin movimiento.
- **Movimientos asociados al CDT**: transferencia de apertura, ingreso por interés neto de cada periodo, transferencias de aporte y de retiro en renovaciones. Todos quedan vinculados al periodo que los generó.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de los ejemplos de la tabla de FR-001 y de los plazos de 30 a 3650 días (en múltiplos de 30) producen la misma fecha de vencimiento que la regla comercial de referencia.
- **SC-002**: El usuario puede registrar un CDT existente sin histórico en menos de 1 minuto, sin que cambie el saldo de ninguna otra cuenta.
- **SC-003**: Tras ajustar el valor final al reportado por el banco, el valor neto mostrado coincide al centavo con el del banco en el 100 % de los casos.
- **SC-004**: El usuario puede renovar un CDT vencido con cualquiera de las tres operaciones en menos de 1 minuto, y el saldo de la cuenta del CDT tras la renovación es igual al capital del nuevo periodo.
- **SC-005**: Tras borrar un CDT, los saldos de todas las cuentas involucradas vuelven exactamente a los valores que tenían antes de crearlo.
- **SC-006**: Ningún CDT puede renovarse antes de su fecha de vencimiento.

## Assumptions

- La TEA, la retención y el plazo los ingresa el usuario; la retención por defecto sigue siendo 4 %.
- La moneda es COP (único soporte del MVP).
- **Fuera de alcance** (spec posterior): liquidar un CDT vencido sin renovarlo (retirar el valor final completo y cerrarlo) y registrar pagos periódicos de intereses. El botón "Registrar vencimiento" sigue deshabilitado; un CDT vencido no renovado permanece activo y pendiente de renovar.
- "Retirar capital" puede tomar parte del capital o de los intereses indistintamente: se modela como un único monto retirado del valor final.
- En una renovación solo se elige una operación (no se aporta y retira a la vez).
- Los CDTs creados antes de esta feature conservan su tasa nominal y vencimiento guardados; su origen se considera "transferencia".
- El borrado es lógico y se propaga por la sincronización existente; no hay papelera ni deshacer.
- La función `helpComercialDays` del usuario es la referencia de comportamiento para la fecha de vencimiento; su limitación de 24 meses no se replica.
