# Data Model: Migración de movimientos desde la base antigua

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-10-18

No hay cambios de esquema: se escribe en las tablas `accounts` y `transactions` existentes ([`docs/db-finanzas.md`](../../docs/db-finanzas.md), migración `0001_initial_schema`). Este documento describe las entidades de origen, las intermedias (en memoria del script) y la correspondencia con las de destino.

## 1. Origen (dump, solo lectura)

### `LegacyMovement` — fila de `movements`

| Campo | Tipo en el dump | Uso |
|---|---|---|
| `id` | int | Clave de idempotencia (R3) y orden del emparejamiento (R2). |
| `description` | text | → `transactions.description` (sin cambios). |
| `amount` | decimal(10,2) con signo | El signo da la dirección y el valor absoluto el monto. Se maneja como string y centavos `BigInt`. |
| `movementDate` | date | → `occurred_at` (R7). |
| `location` | int | → cuenta nueva según el mapa de §2. |
| `cdt` | int / NULL | Si no es NULL, se excluye (FR-003). |

**Validación**: formato de línea estricto; fecha real `YYYY-MM-DD`; monto `^-?\d+\.\d{2}$`.

## 2. Mapa de ubicaciones (constante del script)

| `location` | Nombre antiguo | Destino | Clave | `type` | `is_archived` | `sort_order` |
|---|---|---|---|---|---|---|
| 1 | Efectivo | **Efectivo** | `cash` | `CASH` | false | 0 |
| 8 | Bolsillo | **Efectivo** (fusión) | `cash` | — | — | — |
| 2 | Nequi | **Nequi** | `nequi` | `SAVINGS` | false | 1 |
| 5 | Bancolombia | **Bancolombia** | `bancolombia` | `SAVINGS` | false | 2 |
| 6 | A la mano | **A la mano** | `alamano` | `SAVINGS` | true | 3 |
| 7 | Global66 | **Global66** | `global66` | `SAVINGS` | true | 4 |
| 3, 9 | CDT Bancamia | — excluida (`CDT`) | | | | |
| 4 | Paypal (USD) | — excluida (`USD`) | | | | |
| otra | — | **abortar** (R8) | | | | |

Todas las cuentas creadas: `nature = 'ASSET'`, `currency = 'COP'`, `opening_balance = 0`, `parent_account_id = NULL`.

## 3. Entidades intermedias (plan de migración, en memoria)

### `PlannedAccount`

`key`, `name`, `type`, `isArchived`, `sortOrder`, `id` (resuelto: existente reutilizada o UUIDv5 nuevo), `action` (`create` / `reuse` / `reuse+archive`).

### `PlannedTransaction`

| Campo | Ingreso/egreso | Transferencia |
|---|---|---|
| `id` | `uuidv5(NS, "movement:<id>")` | `uuidv5(NS, "transfer:<idSalida>:<idEntrada>")` |
| `type` | `INCOME` si monto > 0; `EXPENSE` si < 0 | `TRANSFER` |
| `accountKey` | cuenta de la ubicación | cuenta de la pata negativa |
| `counterAccountKey` | NULL | cuenta de la pata positiva (≠ `accountKey`) |
| `amount` | valor absoluto (string `"1234.56"`) | valor absoluto común |
| `occurredOn` | `movementDate` | fecha común de ambas patas |
| `description` | la del movimiento | la de la pata de salida |
| `sourceIds` | `[id]` | `[idSalida, idEntrada]` |

### `MigrationSummary`

- **Conteos**: leídos, incluidos, excluidos por motivo (`CDT`, `USD`, `ZERO_AMOUNT`), candidatas a transferencia, transferencias formadas, pares descartados por fusión, patas sueltas, ingresos y egresos.
- **Por cuenta**: número de movimientos y saldo esperado en centavos.
- **Tras escribir**: insertados frente a ya existentes, y cuentas creadas, reutilizadas o archivadas.
- **Usuario usado**: `id` y `email`.

**Invariantes** (si alguno falla, se aborta):
- `leídos = incluidos + Σ excluidos`
- `incluidos = 2·transferencias + 2·descartados + sueltos`, donde `sueltos` son las filas que no forman par, sean o no candidatas
- `registros planificados = transferencias + sueltos`
- `saldo esperado(cuenta) = Σ montos con signo de sus ubicaciones de origen`. Las transferencias y los descartes no alteran ningún saldo.

**Valores esperados con el dump del 17-10-2026**: 2.149 leídos; 2.137 incluidos; 12 excluidos por CDT (11 de ubicación 3 y 1 de ubicación 9); 0 por USD; 201 transferencias; 7 descartados; 1.721 sueltos; 1.922 registros.

| Cuenta | Saldo esperado |
|---|---|
| Efectivo | 344.800,00 |
| Nequi | 6,91 |
| Bancolombia | 200.000,79 |
| A la mano | 0,00 |
| Global66 | 0,00 |

## 4. Destino (PostgreSQL)

### `accounts` (insertar o reutilizar)

`id`, `user_id` (el único usuario), `name`, `type`, `nature`, `currency`, `opening_balance`, `is_archived`, `sort_order`, `is_excluded_from_net_worth = false`, `created_at = updated_at = now()`, `deleted_at = NULL`, `server_updated_at` = valor por defecto.

### `transactions` (insertar con `ON CONFLICT (id) DO NOTHING`)

`id`, `user_id`, `account_id`, `counter_account_id`, `type`, `amount`, `category_id = NULL`, `category_source = 'MANUAL'`, `occurred_at`, `description`. El resto de FKs (`reimbursement_group_id`, `subscription_id`, `subscription_period`, `recurring_income_id`, `recurring_income_period`, `cdt_id`) quedan en NULL. Además, `created_at = updated_at = now()`, `deleted_at = NULL` y `server_updated_at` = valor por defecto.

**Restricciones del esquema que el plan ya garantiza**:
- `amount > 0`: los montos cero se excluyen.
- `(type = 'TRANSFER') = (counter_account_id IS NOT NULL)`.
- `counter_account_id <> account_id`: los pares de la misma cuenta se descartan.
- FKs compuestas `(user_id, account_id)`: las cuentas pertenecen al mismo usuario.

### Verificación posterior (dentro de la transacción)

Saldo por cuenta calculado en SQL solo sobre los IDs de la migración, como `Σ INCOME − Σ EXPENSE − Σ TRANSFER salientes + Σ TRANSFER entrantes`. Debe ser igual al saldo esperado de §3.
