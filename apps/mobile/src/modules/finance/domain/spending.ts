import type { Decimal } from 'decimal.js';

import { isWithin, periodRangeUtc, shiftPeriod, type Period } from '@/lib/dates';
import { percentOf, sum, type Cents } from '@/lib/money';

import { delta, isPersonalFlow, type Delta } from './flows';
import type { Category, CategoryKind, Transaction } from './types';

export { delta, isPersonalExpense, type Delta } from './flows';

export interface CategoryFlowItem {
  categoryId: string | null;
  name: string;
  color: string | null;
  icon: string | null;
  amount: Cents;
  /** Porcentaje del total (0–100). */
  pct: Decimal;
  delta: Delta;
}

export interface CategoryFlowReport {
  kind: CategoryKind;
  period: Period;
  total: Cents;
  previousTotal: Cents;
  delta: Delta;
  items: CategoryFlowItem[];
}

export type SpendingItem = CategoryFlowItem;
export type SpendingReport = CategoryFlowReport;

export interface EvolutionPoint {
  period: Period;
  total: Cents;
}

export const UNCATEGORIZED = 'Sin categoría';

function flowsIn(transactions: Transaction[], period: Period, kind: CategoryKind): Transaction[] {
  const range = periodRangeUtc(period);
  return transactions.filter((t) => isPersonalFlow(t, kind) && isWithin(t.occurredAt, range));
}

function byCategory(transactions: Transaction[]): Map<string | null, Cents> {
  const totals = new Map<string | null, Cents[]>();
  for (const t of transactions) totals.set(t.categoryId, [...(totals.get(t.categoryId) ?? []), t.amount]);
  return new Map([...totals].map(([k, v]) => [k, sum(v)]));
}

/** Ingresos o gastos personales del periodo agrupados por categoría, con variación vs. el anterior. */
export function categoryFlowReport(
  transactions: Transaction[],
  categories: Map<string, Category>,
  period: Period,
  kind: CategoryKind,
): CategoryFlowReport {
  const current = byCategory(flowsIn(transactions, period, kind));
  const previous = byCategory(flowsIn(transactions, shiftPeriod(period, -1), kind));
  const total = sum(current.values());
  const previousTotal = sum(previous.values());

  const items: CategoryFlowItem[] = [...current.entries()]
    .map(([categoryId, amount]) => {
      const category = categoryId ? categories.get(categoryId) : undefined;
      return {
        categoryId,
        name: category?.name ?? UNCATEGORIZED,
        color: category?.color ?? null,
        icon: category?.icon ?? null,
        amount,
        pct: percentOf(amount, total),
        delta: delta(amount, previous.get(categoryId) ?? (0 as Cents)),
      };
    })
    .sort((a, b) => b.amount - a.amount);

  return { kind, period, total, previousTotal, delta: delta(total, previousTotal), items };
}

/** Totales de los últimos `count` periodos, del más antiguo al actual. */
export function categoryFlowEvolution(transactions: Transaction[], period: Period, kind: CategoryKind, count = 6): EvolutionPoint[] {
  return Array.from({ length: count }, (_, i) => {
    const p = shiftPeriod(period, i - (count - 1));
    return { period: p, total: sum(flowsIn(transactions, p, kind).map((t) => t.amount)) };
  });
}

/** Movimientos de una categoría (null = sin categoría) en el periodo, del más reciente al más antiguo. */
export function categoryFlowTransactions(
  transactions: Transaction[],
  categoryId: string | null,
  period: Period,
  kind: CategoryKind,
): Transaction[] {
  return flowsIn(transactions, period, kind)
    .filter((t) => t.categoryId === categoryId)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export function spendingReport(transactions: Transaction[], categories: Map<string, Category>, period: Period): SpendingReport {
  return categoryFlowReport(transactions, categories, period, 'EXPENSE');
}

export function spendingEvolution(transactions: Transaction[], period: Period, count = 6): EvolutionPoint[] {
  return categoryFlowEvolution(transactions, period, 'EXPENSE', count);
}

export function categoryTransactions(transactions: Transaction[], categoryId: string | null, period: Period): Transaction[] {
  return categoryFlowTransactions(transactions, categoryId, period, 'EXPENSE');
}
