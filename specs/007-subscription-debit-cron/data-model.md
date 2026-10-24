# Data Model: Débito automático diario de suscripciones y zona horaria única del MVP

**No hay cambios de esquema.** Esta feature lee tablas existentes y escribe filas en `transactions` según [`docs/db-finanzas.md`](../../docs/db-finanzas.md). Aquí se documentan la lectura, el mapeo y las reglas.

## Entradas (lectura)

### `subscriptions` (§5)

| Campo | Uso |
|---|---|
| `id` | Parte del nombre UUIDv5 y del vínculo `transactions.subscription_id`. |
| `user_id` | Dueño. Agrupa la transacción y el lock por usuario. |
| `account_id` | Cuenta del egreso. |
| `category_id` | Categoría del egreso si es válida (ver abajo). |
| `name` | `description` del egreso. |
| `amount` | `amount` del egreso (`Decimal`, sin conversión). |
| `billing_cycle` | `MONTHLY` → periodo `YYYY-MM`; `YEARLY` → periodo `YYYY`. |
| `billing_day` | Día de cobro (1–31), ajustado al último día del mes. |
| `billing_month` | Mes de cobro en anuales (1–12). |
| `start_date` | La fecha de cobro debe ser `>=` a esta. |
| `status` | Solo `ACTIVE`. |
| `deleted_at` | Debe ser `NULL`. |

### `accounts` (§1)

Se une por `(user_id, account_id)`. Es **válida** si existe y `deleted_at IS NULL`. `is_archived` **no** afecta (FR-011).

### `categories` (§2)

Se une por `(user_id, category_id)`. Es **válida** si existe, `deleted_at IS NULL` y `kind = 'EXPENSE'`. Si no es válida, el egreso se registra con `category_id = NULL` (FR-012).

### `users`

La suscripción debe tener dueño. El `ON DELETE CASCADE` ya elimina las suscripciones de usuarios borrados; el `JOIN` cubre el caso de un borrado durante la ejecución.

### `alembic_version`

`version_num` debe ser igual al head de la imagen (research R6).

## Salida (escritura): fila en `transactions` (§3)

| Columna | Valor |
|---|---|
| `id` | `uuid5(9d1e0cb1-0ae7-5d67-856e-c19860851ef1, f"{subscription_id}:{period}")` (research R4) |
| `user_id` | `subscriptions.user_id` |
| `account_id` | `subscriptions.account_id` |
| `counter_account_id` | `NULL` |
| `type` | `'EXPENSE'` |
| `amount` | `subscriptions.amount` |
| `category_id` | `subscriptions.category_id` si es válida; si no, `NULL` |
| `category_source` | `'MANUAL'` |
| `occurred_at` | `billing_date` a las 00:00 `America/Bogota`, guardado en UTC (`billing_date` a las 05:00Z) (research R8) |
| `description` | `subscriptions.name` |
| `reimbursement_group_id` | `NULL` |
| `subscription_id` | `subscriptions.id` |
| `subscription_period` | `YYYY-MM` (mensual) o `YYYY` (anual) |
| `recurring_income_id` / `recurring_income_period` | `NULL` |
| `cdt_id` | `NULL` |
| `created_at` / `updated_at` | Instante de la ejecución (UTC, reloj inyectado) |
| `deleted_at` | `NULL` |
| `server_updated_at` | Valor por defecto `clock_timestamp()` (asignado por la base) |

La fila cumple las restricciones vigentes: `amount > 0`, `type` y `category_source` válidos, `transfer_counter` (sin cuenta destino), `subscription_period_format`, FKs compuestas y la regla de coherencia del sync (la categoría de un `EXPENSE` es de gasto).

**Inserción**: `INSERT … ON CONFLICT DO NOTHING RETURNING id`, sin objetivo, para cubrir la PK y `uq_transactions_subscription_id_subscription_period`.

## Reglas derivadas

### Periodo y fecha de cobro para la fecha de referencia `D`

```text
MONTHLY: period = f"{D.year:04}-{D.month:02}"
         billing_date = date(D.year, D.month, min(billing_day, days_in_month(D.year, D.month)))
YEARLY:  period = f"{D.year:04}"
         billing_date = date(D.year, billing_month, min(billing_day, days_in_month(D.year, billing_month)))
```

### Elegibilidad (todas deben cumplirse)

1. `status = 'ACTIVE'` y `deleted_at IS NULL`.
2. `billing_date <= D`. Incluye cobros vencidos del periodo actual, pero nunca de periodos anteriores (FR-007).
3. `billing_date >= start_date` (FR-006).
4. `billing_date >= BILLING_ACTIVATION_DATE` (FR-007a).
5. La cuenta es válida. Si no, el resultado es *omitido: cuenta no disponible* (FR-011).

`D` es "hoy" en `America/Bogota`, o `--date` en una ejecución manual, siempre que no sea posterior a hoy.

### Resultado por suscripción (para el resumen, FR-020)

| Resultado | Cuándo |
|---|---|
| `created` | El `INSERT` devolvió una fila. |
| `existing` | Hubo conflicto: ya existía, incluso borrado o editado (FR-014). |
| `not_due` | No es elegible por las condiciones 2–4. |
| `skipped_account` | La cuenta no existe o está borrada. |
| `failed` | Hubo una excepción dentro del savepoint (se registra el motivo). |

## Entidad no persistida: Ejecución de cobros

| Atributo | Descripción |
|---|---|
| `run_date` | `D`. |
| `trigger` | `startup`, `scheduled` o `manual`. |
| `started_at` / `finished_at` | Instantes en UTC. |
| `users`, `subscriptions` | Número de usuarios y suscripciones revisados. |
| `created`, `existing`, `not_due`, `skipped_account`, `failed` | Conteos. |
| `failures[]` | `(subscription_id, motivo)`, solo con identificadores. |

Se emite solo en el log (formato en [contracts/billing-service.md](./contracts/billing-service.md)).

## Zona horaria (app y servidor)

- **Instantes** (`occurred_at`, `created_at`, `updated_at`, `deleted_at`, `server_updated_at`): se guardan y se intercambian siempre en UTC. No cambian.
- **Fechas puras** (`start_date`, `maturity_date`, etc. en `YYYY-MM-DD`): se interpretan como días del calendario de Bogotá.
- **Día de un instante**: `localDayKey(instant)` en `America/Bogota`. Ejemplo: `2026-10-25T04:30:00Z` corresponde al 24 de octubre.
- **Mes y año de los resúmenes**: el rango `[inicio, fin)` es de Bogotá en UTC. Octubre de 2026 va de `2026-10-01T05:00:00Z` a `2026-11-01T05:00:00Z`.
- **Datos existentes**: no se migran. Los movimientos que alguien registró con el dispositivo en otra zona conservan su instante y pueden verse en otro día; es el comportamiento esperado (spec, casos límite).
