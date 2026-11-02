# Data Model: Dashboard de Inicio (finanzas)

Esta feature **no agrega tablas, columnas ni cambios de sincronización**. Todo lo que sigue son tipos derivados en memoria del cliente (`apps/mobile`), calculados a partir de entidades existentes (`Account`, `Transaction`, `Cdt`, `Subscription`, `Asset`).

## DashboardWidget (registro, no persistido)

| Campo | Tipo | Regla |
|---|---|---|
| `id` | `string` | Único en todo el registro (p. ej. `finance.net-worth`). |
| `moduleId` | `string` | Debe coincidir con un `AppModule.id`; solo se renderizan los de módulos `active`. |
| `order` | `number` | Orden ascendente en el tablero; los empates se resuelven por `id`. |
| `span` | `'full' \| 'half'` | En < 1024 px se ignora (todo a ancho completo); en ≥ 1024 px, `half` ocupa ~50 %. |
| `Widget` | `ComponentType` | Sin props; obtiene sus datos con hooks propios. |

Widgets de Finanzas en esta feature:

| id | order | span |
|---|---|---|
| `finance.net-worth` | 10 | full |
| `finance.month-flow` | 20 | half |
| `finance.upcoming` | 30 | half |

## UpcomingItem (derivado)

| Campo | Tipo | Regla |
|---|---|---|
| `kind` | `'CARD_PAYMENT' \| 'CDT_MATURITY' \| 'SUBSCRIPTION'` | |
| `sourceId` | `string` | id de la cuenta, el CDT o la suscripción. |
| `name` | `string` | Nombre de la cuenta / `CDT <emisor>` / nombre de la suscripción. |
| `date` | `IsoDate` | Fecha en America/Bogota. |
| `daysUntil` | `number` | `daysBetween(today, date)`; negativo = vencido (solo CDT). |
| `amount` | `Cents` | Deuda actual / `maturityValue` / monto del cobro. Siempre ≥ 0. |
| `currency` | `'COP'` | Única moneda del MVP. |
| `urgent` | `boolean` | `daysUntil ≤ 1` (hoy, mañana o vencido). |
| `overdue` | `boolean` | `daysUntil < 0`. |

**Reglas de inclusión** (ventana `W = MATURING_SOON_DAYS = 15`):

- `SUBSCRIPTION`: `status === 'ACTIVE'`, no borrada, `0 ≤ daysUntil ≤ W` (próximo cobro según `nextBillingDate`).
- `CDT_MATURITY`: `status === 'ACTIVE'`, no borrado, `daysUntil ≤ W` (incluye negativos).
- `CARD_PAYMENT`: `type === 'CREDIT_CARD'`, no archivada ni borrada, `paymentDueDay !== null`, `debtOf(saldo) > 0`, `0 ≤ daysUntil ≤ W`.
- La exclusión del patrimonio (`isExcludedFromNetWorth`) **no** afecta la inclusión.

**Orden**: `date` ↑, `kind` (CARD_PAYMENT < CDT_MATURITY < SUBSCRIPTION), `name` (`localeCompare('es')`), `sourceId`.

## NetWorthSnapshot (derivado, reutiliza dominio existente)

| Campo | Origen |
|---|---|
| `netWorth` | `netWorthReport(...).netWorth` |
| `evolution` | `netWorthEvolution(..., today, 12)`: 12 `NetWorthPoint` |
| `monthDelta` | `evolution[11].netWorth − evolution[10].netWorth` (`Cents`, con signo) |
| `isEmpty` | sin cuentas activas no archivadas, sin CDTs vivos y sin bienes |

## MonthFlow (derivado, reutiliza dominio existente)

`monthSummary(transactions, { granularity: 'MONTH', anchor: today })` → `income`, `expense` y `balance` (`Cents`). La proporción de cada barra es `x / max(income, expense)` y se calcula solo para presentación; si ambos son 0, las dos barras quedan vacías.
