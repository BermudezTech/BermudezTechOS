# Feature Specification: Ingresos recurrentes con valor sugerido

**Feature Branch**: `002-recurring-income`

**Created**: 2026-10-17

**Status**: Draft

**Input**: User description: "Quiero añadir una función en el frontend que me permita seleccionar ingresos recurrentes cuyo valor ya está establecido o se puede modificar, ejemplo el salario prácticamente siempre es el mismo, pero se puede cambiar su valor.... Entonces, añade la función al frontend y adicional, añadelo a la documentación y si se necesita alguna tabla adicional en @docs/db-finanzas.md"

**Documentos de referencia**: [`docs/modulo-finanzas.md`](../../docs/modulo-finanzas.md) (§2 Movimientos, §4 Suscripciones) y [`docs/db-finanzas.md`](../../docs/db-finanzas.md).

## Resumen

Permitir que el usuario defina **ingresos recurrentes** (salario, arriendo recibido, honorarios fijos, pensión…) con un **valor esperado**, una periodicidad y una cuenta de destino. Al registrar un ingreso, el usuario puede **seleccionar uno de estos ingresos recurrentes** y el formulario se llena con sus datos; el valor queda **editable** porque puede variar (horas extra, bonificaciones, descuentos). Es el equivalente, para ingresos, de las suscripciones (§4), con la diferencia clave de que el valor real puede diferir del esperado.

## Alcance

**Incluido**:

- Crear, editar, pausar y eliminar ingresos recurrentes.
- Registrar un ingreso a partir de un ingreso recurrente, con el valor sugerido editable.
- Documentar la funcionalidad en `docs/modulo-finanzas.md` y el modelo de datos en `docs/db-finanzas.md`.

**Excluido**:

- Gastos recurrentes (ya cubiertos por Suscripciones, §4).
- Vista de ingresos recurrentes pendientes o recibidos por periodo.
- Notificaciones push o recordatorios fuera de la app.
- Persistencia real, sincronización y API: igual que la spec 001, esta fase usa los datos en memoria de la interfaz.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar un ingreso desde un ingreso recurrente (Priority: P1)

Cuando llega el salario, el usuario abre "Nuevo movimiento", elige el tipo ingreso y selecciona "Salario" de su lista de ingresos recurrentes. El formulario se llena con el valor esperado, la cuenta de destino, la categoría y la descripción. Si ese mes el valor fue distinto, lo corrige antes de guardar.

**Why this priority**: es el valor central de la función: registrar el ingreso más frecuente en segundos y sin errores de digitación.

**Independent Test**: con un ingreso recurrente de prueba ya definido, registrar un ingreso desde él con y sin cambiar el valor, y verificar el movimiento creado y los saldos.

**Acceptance Scenarios**:

1. **Given** existe el ingreso recurrente "Salario" de $5.000.000 a la cuenta "Nómina", **When** el usuario lo selecciona en el formulario de nuevo ingreso, **Then** el valor, la cuenta, la categoría y la descripción quedan prellenados.
2. **Given** el formulario prellenado con $5.000.000, **When** el usuario cambia el valor a $5.350.000 y guarda, **Then** se registra un ingreso por $5.350.000 y el valor esperado de "Salario" sigue en $5.000.000.
3. **Given** el formulario prellenado, **When** el usuario cambia la cuenta o la fecha antes de guardar, **Then** el ingreso se registra con los datos modificados.
4. **Given** el usuario seleccionó un ingreso recurrente, **When** decide quitar la selección, **Then** el formulario vuelve a ser un ingreso manual sin vínculo.

---

### User Story 2 - Administrar ingresos recurrentes (Priority: P1)

El usuario crea, edita, pausa y elimina sus ingresos recurrentes desde una sección propia de Finanzas.

**Why this priority**: sin ingresos recurrentes definidos no hay nada que seleccionar; es prerrequisito de la historia 1.

**Independent Test**: crear un ingreso recurrente, editar su valor esperado, pausarlo y eliminarlo, verificando la lista en cada paso.

**Acceptance Scenarios**:

1. **Given** la sección de ingresos recurrentes vacía, **When** el usuario crea "Salario" (valor $5.000.000, mensual, día 30, cuenta "Nómina", categoría "Salario"), **Then** aparece en la lista con su valor, periodicidad y día esperado.
2. **Given** un ingreso recurrente, **When** el usuario cambia su valor esperado, **Then** los registros futuros usan el nuevo valor y los ingresos ya registrados no cambian.
3. **Given** un ingreso recurrente pausado, **When** el usuario abre el selector del formulario de ingreso, **Then** no aparece entre las opciones.
4. **Given** un ingreso recurrente con ingresos ya registrados, **When** el usuario lo elimina, **Then** desaparece de la lista y los ingresos registrados se conservan.

---

### Edge Cases

- Día esperado 31 en un mes más corto: la fecha esperada es el último día del mes (misma regla que suscripciones).
- Registrar dos veces el mismo ingreso recurrente en un periodo (p. ej. prima o un pago partido): se permite. Antes de guardar el segundo, se avisa que ya hay uno registrado.
- Editar o eliminar un ingreso registrado desde un recurrente: se comporta como cualquier movimiento; el ingreso recurrente no cambia.
- Valor editado en cero o vacío: no se permite guardar (validación de monto existente).
- La cuenta de destino del ingreso recurrente fue eliminada o archivada: el ingreso recurrente se muestra con aviso y no se puede registrar hasta elegir otra cuenta.
- Ingreso recurrente anual (p. ej. prima de fin de año): el ingreso registrado se vincula al año como periodo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Los usuarios MUST poder crear un ingreso recurrente con: nombre, ícono opcional, valor esperado, periodicidad (mensual o anual), día esperado (1–31), mes esperado (solo anual), cuenta de destino, categoría de ingreso opcional, fecha de inicio y estado (activo o pausado).
- **FR-002**: Los usuarios MUST poder editar, pausar, reactivar y eliminar un ingreso recurrente.
- **FR-003**: El formulario de nuevo movimiento de tipo ingreso MUST ofrecer un selector con los ingresos recurrentes **activos**.
- **FR-004**: Al seleccionar un ingreso recurrente, el sistema MUST prellenar valor, cuenta, categoría y descripción, y la fecha con hoy.
- **FR-005**: Todos los campos prellenados MUST seguir siendo editables antes de guardar, en especial el valor.
- **FR-006**: Modificar el valor de un ingreso registrado MUST NOT cambiar el valor esperado del ingreso recurrente.
- **FR-007**: Cada ingreso registrado desde un ingreso recurrente MUST quedar vinculado a él y al periodo al que corresponde (mes, o año si es anual).
- **FR-008**: Cambiar el valor esperado de un ingreso recurrente MUST afectar solo a los registros posteriores, nunca a los ingresos ya registrados.
- **FR-009**: Eliminar un ingreso recurrente MUST conservar los ingresos ya registrados, que quedan como ingresos normales.
- **FR-010**: El sistema MUST avisar, sin bloquear, si el ingreso recurrente seleccionado ya tiene un ingreso registrado en el periodo.
- **FR-011**: Los ingresos registrados desde un ingreso recurrente MUST contarse en "Ingresos del mes" y "Balance del mes" como cualquier ingreso.
- **FR-012**: El sistema MUST NOT registrar ingresos automáticamente; siempre los confirma el usuario.
- **FR-013**: Todo funciona sin conexión y con tema claro y oscuro, como el resto de Finanzas.
- **FR-014**: La funcionalidad MUST quedar documentada en `docs/modulo-finanzas.md` y su modelo de datos (entidad nueva y vínculo con movimientos) en `docs/db-finanzas.md`.

### Key Entities *(include if feature involves data)*

- **Ingreso recurrente**: plantilla de un ingreso que se repite. Atributos: nombre, ícono, valor esperado, moneda, periodicidad, día y mes esperados, fecha de inicio, estado, cuenta de destino, categoría. Pertenece a un usuario.
- **Movimiento (ingreso)**: se amplía con un vínculo opcional al ingreso recurrente que lo originó y al periodo que cubre. Su valor es el real, independiente del esperado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Registrar un ingreso recurrente sin cambiar el valor toma 3 toques o menos desde "Nuevo movimiento" (tipo ingreso, seleccionar, guardar).
- **SC-002**: Registrar un ingreso recurrente con el valor corregido toma menos de 15 segundos.
- **SC-003**: El 100 % de los ingresos registrados conserva su valor real después de cambiar el valor esperado del ingreso recurrente.
- **SC-004**: Ningún ingreso se registra sin confirmación explícita del usuario.

## Assumptions

- Se registra manualmente porque el valor real suele variar (FR-012); a diferencia de las suscripciones, no hay generación automática.
- Periodicidades mensual y anual, como en suscripciones; quincenal o semanal quedan para una fase posterior.
- La moneda es la de la cuenta de destino (COP en el MVP).
- Se accede desde una sección nueva de Finanzas, "Ingresos recurrentes", y desde el formulario de nuevo ingreso.
- Implementación en la interfaz con datos en memoria, igual que la spec 001; la tabla se diseña en `docs/db-finanzas.md` siguiendo sus convenciones (UUID de cliente, `created_at`/`updated_at`/`deleted_at`, `user_id` solo en servidor, montos `NUMERIC(14,2)`).
- Los datos de prueba incluyen al menos un ingreso recurrente (salario).
