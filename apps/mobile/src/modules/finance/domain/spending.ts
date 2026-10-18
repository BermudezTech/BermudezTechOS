import { Decimal } from 'decimal.js';

import { isWithin, periodRangeUtc, shiftPeriod, type Period } from '@/lib/dates';
import { percentOf, sub, sum, type Cents } from '@/lib/money';

import type { Category, Transaction } from './types';

/** Variación vs. periodo anterior: porcentaje, 'new' si antes era 0, null si ambos son 0. */
export type Delta = Decimal | 'new' | null;

export interface SpendingItem {
  categoryId: string | null;
  name: string;
  color: string | null;
  icon: string | null;
  amount: Cents;
  /** Porcentaje del total (0–100). */
  pct: Decimal;
  delta: Delta;
}

export interface SpendingReport {
  period: Period;
  total: Cents;
  previousTotal: Cents;
  delta: Delta;
  items: SpendingItem[];
}

export interface EvolutionPoint {
  period: Period;
  total: Cents;
}

export const UNCATEGORIZED = 'Sin categoría';

/**
 * Gasto personal = EXPENSE sin grupo de reembolso (data-model). Las transferencias, incluido
 * el pago de tarjeta, quedan fuera por tipo (FR-022).
 */
export function isPersonalExpense(t: Transaction): boolean {
  return !t.deletedAt && t.type === 'EXPENSE' && t.reimbursementGroupId === null;
}

function expensesIn(transactions: Transaction[], period: Period): Transaction[] {
  const range = periodRangeUtc(period);
  return transactions.filter((t) => isPersonalExpense(t) && isWithin(t.occurredAt, range));
}

function byCategory(transactions: Transaction[]): Map<string | null, Cents> {
  const totals = new Map<string | null, Cents[]>();
  for (const t of transactions) totals.set(t.categoryId, [...(totals.get(t.categoryId) ?? []), t.amount]);
  return new Map([...totals].map(([k, v]) => [k, sum(v)]));
}

/** (actual − anterior) / anterior; sin anterior ⇒ 'new'. */
export function delta(current: Cents, previous: Cents): Delta {
  if (previous === 0) return current === 0 ? null : 'new';
  return new Decimal(sub(current, previous)).div(previous).mul(100);
}

export function spendingReport(transactions: Transaction[], categories: Map<string, Category>, period: Period): SpendingReport {
  const current = byCategory(expensesIn(transactions, period));
  const previous = byCategory(expensesIn(transactions, shiftPeriod(period, -1)));
  const total = sum(current.values());
  const previousTotal = sum(previous.values());

  const items: SpendingItem[] = [...current.entries()]
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

  return { period, total, previousTotal, delta: delta(total, previousTotal), items };
}

/** Totales de los últimos `count` periodos, del más antiguo al actual. */
export function spendingEvolution(transactions: Transaction[], period: Period, count = 6): EvolutionPoint[] {
  return Array.from({ length: count }, (_, i) => {
    const p = shiftPeriod(period, i - (count - 1));
    return { period: p, total: sum(expensesIn(transactions, p).map((t) => t.amount)) };
  });
}

/** Movimientos de una categoría (null = sin categoría) en el periodo, del más reciente al más antiguo. */
export function categoryTransactions(transactions: Transaction[], categoryId: string | null, period: Period): Transaction[] {
  return expensesIn(transactions, period)
    .filter((t) => t.categoryId === categoryId)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}
