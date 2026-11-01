# Contract — Navegación, rutas y secciones (008)

Amplía [specs/001-finance-ui-mockup/contracts/navigation.md](../../001-finance-ui-mockup/contracts/navigation.md). Las rutas `new` y `edit` se presentan como modal por la regla existente de `finance/_layout.tsx`.

## Rutas nuevas

| URL | Pantalla | Presentación | Historia |
|---|---|---|---|
| `/finance/income?granularity=&anchor=` | Ingresos por categoría | stack | US2 |
| `/finance/income/[categoryId]?granularity=&anchor=` | Movimientos de ingreso de una categoría (`none` = sin categoría) | stack | US2 |
| `/finance/balance?granularity=&anchor=` | Balance | stack | US3 |
| `/finance/categories` | Categorías (Egresos / Ingresos) | stack | US4 |
| `/finance/categories/new?kind=EXPENSE\|INCOME` | Crear categoría (tipo preseleccionado; editable) | modal | US4 |
| `/finance/categories/[id]/edit` | Editar categoría (tipo de solo lectura) | modal | US4 |

`granularity` ∈ `MONTH | YEAR` (por defecto `MONTH`) y `anchor` = `YYYY-MM-DD` (por defecto hoy), leídos con `usePeriodParams`, igual que en `/finance/spending`.

Si el `anchor` cae antes de `firstActivityMonth`, se ajusta a ese mes; si es posterior al periodo en curso, se ajusta al periodo en curso.

## Rutas modificadas

| URL | Cambio |
|---|---|
| `/finance` | Selector de mes encima de las estadísticas (US1). |
| `/finance/spending` | `PeriodSwitcher` con límite inferior `firstActivityMonth`. |
| `/finance/net-worth` | Selector de rango 6M/12M/24M/Todo sobre la gráfica (US5). |
| `/finance/transactions/new`, `/finance/transactions/[id]/edit` | Chip "+ Nueva" en categorías, que abre una hoja (no una ruta). |

## Enlaces de las tarjetas del Resumen (FR-005)

`<m>` = primer día del mes seleccionado en el Resumen.

| Tarjeta | Destino |
|---|---|
| Ingresos | `/finance/income?granularity=MONTH&anchor=<m>` |
| Gastos | `/finance/spending?granularity=MONTH&anchor=<m>` |
| Balance | `/finance/balance?granularity=MONTH&anchor=<m>` |

Dentro de Balance, las filas de ingresos y gastos navegan a `/finance/income` y `/finance/spending` con el **mismo** `granularity` y `anchor`.

## `financeSections` (orden final)

| id | label | description | icon | route | summaryCards |
|---|---|---|---|---|---|
| `accounts` | Cuentas | Saldos, cajitas y tarjetas | `wallet-outline` | `/finance/accounts` | — |
| `transactions` | Movimientos | Ingresos, egresos y transferencias | `receipt-outline` | `/finance/transactions` | `recent` (10) |
| `income` | Ingresos por categoría | Mensual y anual, con evolución | `arrow-down-circle-outline` | `/finance/income` | `month-income` (1) |
| `spending` | Gastos por categoría | Mensual y anual, con evolución | `pie-chart-outline` | `/finance/spending` | `month-spending` (2) |
| `balance` | Balance | Ingresos − gastos por periodo | `swap-vertical-outline` | `/finance/balance` | `month-balance` (3) |
| `net-worth` | Patrimonio | Activos, pasivos y evolución | `analytics-outline` | `/finance/net-worth` | `net-worth` (4) |
| `categories` | Categorías | Crea y edita tus categorías | `pricetags-outline` | `/finance/categories` | — |
| `investments` … `reimbursements` | sin cambios | | | | |


El `MonthSelector` no es una tarjeta del registro. `FinanceHomeScreen` lo renderiza encima de la cuadrícula de estadísticas (las tarjetas con `order < 10`).
