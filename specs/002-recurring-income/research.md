# Research: Ingresos recurrentes con valor sugerido

No quedaron puntos "NEEDS CLARIFICATION" en el contexto técnico. Estas son las decisiones de diseño.

## R1. Entidad nueva vs. reutilizar `Subscription`

- **Decision**: entidad nueva `RecurringIncome`.
- **Rationale**: las suscripciones generan débitos automáticos con ID determinista y UNIQUE por periodo; los ingresos recurrentes son plantillas manuales, permiten varios registros por periodo y su valor real varía. Mezclarlos exigiría condicionales por dirección en generación, validación de categoría y UI.
- **Alternatives considered**: `subscriptions` con columna `direction` (rechazada por las diferencias anteriores); solo "favoritos" de movimientos sin periodicidad (rechazada: la spec pide periodicidad y día esperado).

## R2. Dónde vive el selector

- **Decision**: componente `RecurringIncomePicker` dentro de `TransactionForm`, visible solo con tipo **Ingreso** y al **crear** (no al editar).
- **Rationale**: cumple SC-001 (tipo ingreso → seleccionar → guardar) sin pantallas intermedias. Al editar, el vínculo se conserva pero no se cambia la plantilla, para no reescribir campos ya confirmados.
- **Alternatives considered**: pantalla previa "elige plantilla" (más toques); slot inyectado como `renderGroupField` (innecesario: la sección es del mismo módulo).

## R3. Prellenado

- **Decision**: al seleccionar se hace `setValue` de `amount` (valor esperado), `accountId`, `categoryId`, `description` (= nombre) y `date` (= hoy). Al quitar la selección solo se borra el vínculo; los campos quedan como estén.
- **Rationale**: FR-004/FR-005; borrar los campos al deseleccionar haría perder lo que el usuario ya corrigió.
- **Alternatives considered**: restaurar los valores previos al deseleccionar (más estado, poco valor).

## R4. Periodo del movimiento

- **Decision**: `recurringIncomePeriod` se calcula al guardar desde la **fecha local** del movimiento: `YYYY-MM` en mensuales y `YYYY` en anuales. Si se edita la fecha, se recalcula.
- **Rationale**: misma convención que `subscription_period`; refleja cuándo se recibió realmente.
- **Alternatives considered**: periodo elegido manualmente (un campo más, sin necesidad en la spec).

## R5. Aviso de duplicado (FR-010)

- **Decision**: función pura `hasEntryInPeriod(transactions, recurringIncomeId, period, excludeId?)`; el formulario muestra un texto de advertencia no bloqueante cuando es verdadera.
- **Rationale**: se permite la prima o un pago partido; solo se informa.

## R6. Coherencia del vínculo

- **Decision**: el repositorio valida que el vínculo solo exista con `type = INCOME` y que la plantilla exista (borrada o no, para editar históricos). Si el usuario cambia el tipo a egreso o transferencia, el formulario quita el vínculo.
- **Rationale**: evita ingresos recurrentes asociados a egresos (regla de `docs/db-finanzas.md`).

## R7. Estados y borrado

- **Decision**: `status` `ACTIVE ⇄ PAUSED`; eliminar = borrado lógico. Los movimientos conservan `recurringIncomeId` (FR-009) y siguen siendo ingresos normales.
- **Alternatives considered**: estado `CANCELLED` como en suscripciones (redundante con el borrado lógico, al no haber generación).

## R8. Categoría

- **Decision**: categoría opcional y solo de `kind = INCOME`, validada en el repositorio (espejo de suscripciones, que exigen `EXPENSE`).
