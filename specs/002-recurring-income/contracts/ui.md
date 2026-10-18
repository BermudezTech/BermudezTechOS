# Contrato de UI: Ingresos recurrentes

## Rutas

| Ruta | Presentación | Contenido |
|---|---|---|
| `/finance/recurring-income` | Stack | Lista de plantillas activas y pausadas: nombre, ícono, valor esperado, periodicidad, día esperado y estado. Botón "+" en el encabezado. Estado vacío con acción "Nuevo ingreso recurrente". |
| `/finance/recurring-income/new` | Modal | `RecurringIncomeForm` vacío. |
| `/finance/recurring-income/[id]/edit` | Modal | `RecurringIncomeForm` con datos, más acciones Pausar/Reactivar y Eliminar (con confirmación). |
| `/finance/transactions/new?type=INCOME&recurringIncomeId=` | Modal | Formulario de movimiento con la plantilla ya seleccionada (param opcional). |

Sección nueva en el hub de Finanzas: **Ingresos recurrentes** · "Salario y otros ingresos fijos" · ícono `cash-outline`.

## `RecurringIncomeForm`

Campos: nombre, ícono, valor esperado, periodicidad (segmentado Mensual/Anual), día esperado, mes esperado (solo Anual), fecha de inicio, cuenta de destino y categoría de ingreso (opcional). Validación con zod en pantalla, igual que `SubscriptionForm`.

## Selector en `TransactionForm`

- Visible solo con tipo **Ingreso** y al crear, si hay al menos una plantilla activa.
- Campo `Select` "Ingreso recurrente (opcional)", con la opción "Ninguno".
- Al elegir: se prellenan valor, cuenta, categoría, descripción y fecha (hoy). Todos siguen editables.
- Debajo del valor: texto de ayuda "Valor esperado: $ X" mientras haya una plantilla seleccionada.
- Aviso no bloqueante (tono `warning`): "Ya registraste {nombre} en {periodo}." si `hasEntryInPeriod`.
- Si se cambia el tipo a Egreso o Transferir, se quita la selección.
