# Contract — Dominio y hooks (008)

Funciones puras en `apps/mobile/src/modules/finance/domain`, cada una con su `*.test.ts`. Los montos son `Cents`; los periodos se calculan en `America/Bogota` con `lib/dates`.

## Reporte por categoría generalizado (`domain/spending.ts`)

```ts
type FlowKind = CategoryKind; // 'INCOME' | 'EXPENSE'

function isPersonalFlow(t: Transaction, kind: FlowKind): boolean;
// EXPENSE → isPersonalExpense(t); INCOME → isPersonalIncome(t)

function categoryFlowReport(tx: Transaction[], categories: Map<string, Category>, period: Period, kind: FlowKind): CategoryFlowReport;
function categoryFlowEvolution(tx: Transaction[], period: Period, kind: FlowKind, count?: number /* 6 */): EvolutionPoint[];
function categoryFlowTransactions(tx: Transaction[], categoryId: string | null, period: Period, kind: FlowKind): Transaction[];

// Se conservan como envoltorios (sin romper llamadas existentes):
const spendingReport = (tx, cats, p) => categoryFlowReport(tx, cats, p, 'EXPENSE');
const spendingEvolution = (tx, p, n) => categoryFlowEvolution(tx, p, 'EXPENSE', n);
const categoryTransactions = (tx, id, p) => categoryFlowTransactions(tx, id, p, 'EXPENSE');
```

Pruebas: con los mismos datos, `categoryFlowReport(…, 'INCOME').total === monthSummary(…).income`, y lo mismo para `EXPENSE`/`expense` (FR-002, SC-002). Los movimientos con reembolso y las transferencias quedan excluidos.

## Balance (`domain/monthSummary.ts`)

```ts
type BalanceDelta = { kind: 'pct'; value: Decimal } | { kind: 'abs'; value: Cents } | null;

function balanceReport(tx: Transaction[], period: Period): BalanceReport;
// balanceDelta: null si ambos balances son 0; 'abs' (actual − anterior) si el anterior ≤ 0; 'pct' en otro caso.

function balanceEvolution(tx: Transaction[], period: Period, count?: number /* 6 */): BalanceEvolutionPoint[];

/** Primer día del mes local del movimiento personal (ingreso o gasto) más antiguo; null si no hay. */
function firstActivityMonth(tx: Transaction[]): IsoDate | null;
```

`monthSummary(tx, period)` no cambia de firma; los hooks le pasan el periodo seleccionado.

## Límites de periodo (`lib/dates.ts`)

```ts
/** Ajusta un periodo a [min, periodo en curso]; min null ⇒ solo tope superior. */
function clampPeriod(period: Period, min: IsoDate | null, today?: IsoDate): Period;
function isSamePeriod(a: Period, b: Period): boolean;
/** Meses [desde, hasta] (primer día de cada mes), del más reciente al más antiguo, agrupados por año. */
function monthsByYear(from: IsoDate, to: IsoDate): { year: number; months: IsoDate[] }[];
```

## Patrimonio (`domain/netWorth.ts`)

```ts
type NetWorthRange = '6M' | '12M' | '24M' | 'ALL';

function firstNetWorthMonth(accounts: Account[], tx: Transaction[], cdts: Cdt[], assets: Asset[]): IsoDate | null;
/** Meses a dibujar: min(N, meses de historial); ALL ⇒ todo el historial; sin datos ⇒ 1. */
function netWorthMonthsFor(range: NetWorthRange, firstMonth: IsoDate | null, today: IsoDate): number;
// netWorthEvolution(accounts, tx, cdts, assets, today, months) sin cambios de firma.
```

Pruebas: con 8 meses de historial, `6M` → 6, `12M` → 8, `24M` → 8 y `ALL` → 8. Sin datos → 1 en todos los rangos.

## Categorías (`domain/categories.ts`)

```ts
function normalizeCategoryName(name: string): string; // trim, NFD sin diacríticos, minúsculas, espacios internos colapsados
function isDuplicateCategoryName(name: string, kind: CategoryKind, categories: Category[], exceptId?: string): boolean;
function nextSortOrder(kind: CategoryKind, categories: Category[]): number;
```

## Hooks (`modules/finance/hooks`)

| Hook | Devuelve |
|---|---|
| `useSummaryMonth()` | `{ month: IsoDate; isCurrent; canPrev; canNext; prev(); next(); select(m); reset(); minMonth: IsoDate \| null }`. El store en memoria guarda `selected: IsoDate \| null`. |
| `useMonthSummary(period?)` | `MonthSummary` del periodo; sin argumento, el mes en curso (compatibilidad). |
| `useIncomeByCategory(period)` | `{ report, evolution }` para `INCOME`. |
| `useCategoryIncome(categoryId, period)` | Movimientos de ingreso de la categoría. |
| `useBalance(period)` | `{ report: BalanceReport; evolution: BalanceEvolutionPoint[] }`. |
| `useFirstActivityMonth()` | `IsoDate \| null`. |
| `useNetWorth(range = '12M')` | `{ report, evolution, firstMonth }`. |
| `useCategoriesByKind()` | `{ EXPENSE: Category[]; INCOME: Category[] }` activas, ordenadas por `sortOrder`. |

## Componentes (props públicas)

```ts
<PeriodSwitcher period onChange min?: IsoDate | null />   // deshabilita "anterior" en min
<MonthSelector />                                          // lee useSummaryMonth; flechas + nombre pulsable + "Mes actual"
<MonthPickerSheet visible months: {year, months}[] selected onSelect onClose />
<CategoryBreakdownList items period basePath: '/finance/spending' | '/finance/income' />
<EvolutionChart points accessibilityPrefix: string color?: string />
<BalanceEvolutionChart points: BalanceEvolutionPoint[] />
<NetWorthRangeSelector value: NetWorthRange onChange />
<CategoryForm initial?: Category fixedKind?: CategoryKind onSubmit(input) onCancel? />
<IconPickerSheet visible value onSelect onClose />
<ColorPalettePicker value onChange />
<CategoryEditorSheet visible kind onCreated(category) onClose />
<TransactionForm … allowCreateCategory?: boolean />
```
