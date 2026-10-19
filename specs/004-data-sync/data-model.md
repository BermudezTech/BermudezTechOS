# Data Model: Sincronización de datos de finanzas

Esta feature **no cambia el esquema** de la base de datos. Las ocho tablas, sus restricciones y los índices `(user_id, server_updated_at)` ya existen (spec 003, migración `0001_initial_schema`). Aquí se describen:

1. Los **registros de sync**: la forma en que cada tabla viaja en PUSH y PULL.
2. Las **reglas por entidad**: validación, referencias y coherencia.
3. Las **entidades de la operación** (lote, resultado, cursor), que no se persisten.

Fuente de verdad de columnas y tipos: [`docs/db-finanzas.md`](../../docs/db-finanzas.md).

## 1. Convenciones del registro de sync

- **Claves en camelCase** (`parentAccountId`), como el resto de la API.
- **Campos comunes a todo registro**:

| Campo | Tipo JSON | PUSH | PULL | Notas |
|---|---|---|---|---|
| `id` | string UUID | obligatorio | ✓ | Generado en el cliente. |
| `createdAt` | string ISO-8601 UTC | obligatorio | ✓ | |
| `updatedAt` | string ISO-8601 UTC | obligatorio | ✓ | Para LWW; ≤ ahora + 24 h. |
| `deletedAt` | string ISO-8601 UTC \| null | opcional (null) | ✓ | Borrado lógico; `null` restaura. |
| `serverUpdatedAt` | string ISO-8601 UTC | **ignorado** | ✓ | Lo asigna el servidor. |
| `userId`, `isDirty` | — | **ignorados** | nunca | Nunca salen del servidor. |

- **Montos** (`MoneyStr`): string `"1234.56"`, hasta 12 enteros y 2 decimales. Un número JSON se rechaza.
- **Tasas** (`RateStr`): string con hasta 3 enteros y 4 decimales. **Porcentajes** (`PercentStr`): hasta 3 enteros y 2 decimales.
- **Fechas sin hora**: `"YYYY-MM-DD"`.
- **El PUSH envía el registro completo** (no parches): los campos opcionales ausentes se guardan como `null` o con su valor por defecto.

## 2. Entidades sincronizables

Orden de aplicación (S6): `categories` → `reimbursement_groups` → `assets` → `accounts` → `subscriptions` → `recurring_incomes` → `cdts` → `transactions`.

En cada tabla:
- **Campos**: el registro además de los comunes.
- **Reglas del registro**: validaciones de Pydantic sobre un solo registro.
- **Referencias**: campos que se resuelven según S6.
- **Coherencia**: las reglas de FR-009a, evaluadas con los registros referenciados.

### 2.1 `categories`

- **Campos**: `name` (1–50), `kind` (`INCOME`|`EXPENSE`), `icon`?, `color`? (≤50), `sortOrder` (int, defecto 0).
- **Referencias**: ninguna.
- **Restricción de base de datos**: nombre único por (`kind`) entre las no borradas → `DUPLICATE`.

### 2.2 `reimbursement_groups`

- **Campos**: `name` (1–100), `payer`? (≤100), `kind` (`REIMBURSEMENT`|`ADVANCE`), `status` (`OPEN`|`SUBMITTED`|`SETTLED`, defecto `OPEN`), `notes`?.
- **Referencias**: ninguna.

### 2.3 `assets`

- **Campos**: `name` (1–100), `value` (MoneyStr ≥ 0), `validUntil` (fecha).
- **Referencias**: ninguna.

### 2.4 `accounts`

- **Campos**: `parentAccountId`?, `name` (1–100), `type` (`CHECKING`|`SAVINGS`|`CASH`|`CREDIT_CARD`|`POCKET`|`INVESTMENT`), `nature` (`ASSET`|`LIABILITY`), `currency` (3 letras, defecto `COP`), `icon`?, `color`?, `openingBalance` (MoneyStr, defecto `"0.00"`), `creditLimit`? (MoneyStr), `statementDay`?, `paymentDueDay`? (1–31), `isExcludedFromNetWorth`, `isArchived` (bool, defecto false), `sortOrder` (int).
- **Reglas del registro**: `CREDIT_CARD` ⇒ `nature = LIABILITY`. `parentAccountId ≠ id`. `currency = COP` en el MVP.
- **Referencias**: `parentAccountId` → `accounts` (con orden topológico dentro del lote).
- **Coherencia**:
  - La cuenta padre no tiene padre (un solo nivel).
  - Una cuenta que tiene subcuentas, en la base o en el lote, no puede recibir `parentAccountId`.

### 2.5 `subscriptions`

- **Campos**: `accountId`, `categoryId`?, `name` (1–100), `icon`? (≤100), `amount` (MoneyStr > 0), `billingCycle` (`MONTHLY`|`YEARLY`), `billingDay` (1–31), `billingMonth`? (1–12), `startDate` (fecha), `status` (`ACTIVE`|`PAUSED`|`CANCELLED`).
- **Reglas del registro**: `billingMonth` es obligatorio si y solo si el ciclo es `YEARLY`.
- **Referencias**: `accountId` → `accounts`; `categoryId` → `categories`.
- **Coherencia**: la categoría, si la hay, tiene `kind = EXPENSE`.

### 2.6 `recurring_incomes`

- **Campos**: `accountId`, `categoryId`?, `name` (1–100), `icon`?, `expectedAmount` (MoneyStr > 0), `cycle` (`MONTHLY`|`YEARLY`), `expectedDay` (1–31), `expectedMonth`? (1–12), `startDate`, `status` (`ACTIVE`|`PAUSED`).
- **Reglas del registro**: `expectedMonth` es obligatorio si y solo si el ciclo es `YEARLY`.
- **Referencias**: `accountId` → `accounts`; `categoryId` → `categories`.
- **Coherencia**: la categoría, si la hay, tiene `kind = INCOME`.

### 2.7 `cdts`

- **Campos**: `accountId`, `issuer` (1–100), `certificateNumber`? (≤50), `principal` (MoneyStr > 0), `annualRateEa`, `annualRateNominal` (RateStr), `termDays` (> 0), `openedOn`, `maturesOn` (fechas), `interestPayment` (`AT_MATURITY`|`MONTHLY`|`QUARTERLY`|`SEMIANNUAL`|`ANNUAL`), `withholdingRate` (PercentStr, defecto `"4.00"`), `sourceAccountId`, `payoutAccountId`?, `status` (`ACTIVE`|`MATURED`|`RENEWED`|`CANCELLED`), `renewedFromCdtId`?.
- **Reglas del registro**: `renewedFromCdtId ≠ id`.
- **Referencias**: `accountId`, `sourceAccountId` y `payoutAccountId` → `accounts`; `renewedFromCdtId` → `cdts` (con orden topológico).
- **Coherencia**:
  - `accountId` es una cuenta `INVESTMENT`.
  - `sourceAccountId ≠ accountId`.
- **Restricción de base de datos**: `accountId` único → `DUPLICATE`.

### 2.8 `transactions`

- **Campos**: `accountId`, `counterAccountId`?, `type` (`INCOME`|`EXPENSE`|`TRANSFER`), `amount` (MoneyStr > 0), `categoryId`?, `categorySource` (`MANUAL`|`AI`), `occurredAt` (ISO UTC), `description`?, `reimbursementGroupId`?, `subscriptionId`?, `subscriptionPeriod`? (`YYYY-MM`|`YYYY`), `recurringIncomeId`?, `recurringIncomePeriod`?, `cdtId`?.
- **Reglas del registro**:
  - `TRANSFER` ⇔ `counterAccountId`, que debe ser distinta de `accountId`. Una `TRANSFER` no lleva `categoryId`.
  - `recurringIncomeId` ⇔ `recurringIncomePeriod`, y solo con `INCOME`.
  - `subscriptionId` solo con `EXPENSE`.
- **Referencias**:
  - `accountId`, `counterAccountId` → `accounts`
  - `categoryId` → `categories`
  - `reimbursementGroupId` → `reimbursement_groups`
  - `subscriptionId` → `subscriptions`
  - `recurringIncomeId` → `recurring_incomes`
  - `cdtId` → `cdts`
- **Coherencia**: si `categoryId` existe, el `kind` de la categoría es igual al `type` del movimiento.
- **Restricción de base de datos**: `(subscriptionId, subscriptionPeriod)` único → `DUPLICATE`. Con el mismo ID determinista, el caso cae en LWW y no en duplicado.

> Las reglas de coherencia se evalúan **al recibir** el registro. Cambiar después un registro referenciado no invalida retroactivamente a los que lo usan (FR-009a).

## 3. Entidades de la operación (no persistidas)

### Lote de PUSH (`PushRequest`)

- `changes`: objeto `{ <tabla>: [registro, …] }` con solo tablas sincronizables. Todas las claves son opcionales.
- Como máximo 500 registros en total (S9).

### Resultado por registro (`RecordResult`)

| Campo | Descripción |
|---|---|
| `table` | Tabla del registro. |
| `id` | ID del registro, o `null` si no se pudo leer un UUID válido. |
| `status` | `APPLIED` \| `DISCARDED` \| `REJECTED`. En la spec: aplicado, descartado y rechazado. |
| `code` | Solo en `REJECTED`; ver tabla de códigos. |
| `message` | Texto en español para registros y depuración. |
| `details` | Opcional: errores de validación por campo. |

**Códigos de rechazo**:

| Código | Cuándo |
|---|---|
| `VALIDATION_ERROR` | Esquema o regla de un registro (incluye montos mal formados). |
| `INVALID_REFERENCE` | Una referencia no existe para el usuario, o hay un ciclo de autorreferencia. |
| `DEPENDENCY_REJECTED` | Una referencia apunta a un registro rechazado en el mismo lote. |
| `INCOHERENT` | Falla una regla de coherencia (FR-009a). |
| `DUPLICATE` | Viola una unicidad de negocio (nombre de categoría, débito por periodo, CDT por cuenta). |
| `ID_CONFLICT` | El UUID ya existe a nombre de otro usuario. El mensaje es genérico. |
| `CLOCK_AHEAD` | `updatedAt` más de 24 h por delante del servidor. |

**Transiciones de un registro en el servidor** (LWW):

```
(no existe) ──PUSH──► existe ──PUSH con updatedAt mayor──► existe (nueva versión, nuevo serverUpdatedAt)
                         │
                         ├──PUSH con deletedAt──► borrado lógico ──PUSH con deletedAt=null y updatedAt mayor──► restaurado
                         └──PUSH con updatedAt ≤ almacenado──► sin cambios (DISCARDED)
```

### Cursor de tabla

- Es un string opaco para la app: base64url de `{t: serverUpdatedAt, id}` (S3).
- La app lo guarda en `sync_metadata` (columna `pull_cursor`, que hoy se llama `last_pulled_server_at` en el documento) solo tras un sync completo de esa tabla.

### Cambio documental

`docs/db-finanzas.md` §9 se actualizará así:
- `last_pulled_server_at` pasa a `pull_cursor` (TEXT, cursor opaco del servidor).
- Se anota que el PULL entrega los registros en orden de dependencias.
