import { Decimal } from 'decimal.js';

import { isWithin, localDayKey, periodRangeUtc, shiftPeriod, type IsoDate, type Period } from '@/lib/dates';
import { sub, sum, type Cents } from '@/lib/money';

import { delta, isPersonalExpense, isPersonalIncome, type Delta } from './flows';
import type { Transaction } from './types';

export { isPersonalIncome } from './flows';

export interface FlowTotals {
  income: Cents;
  expense: Cents;
  /** Ingresos − gastos. */
  balance: Cents;
}

export interface MonthSummary extends FlowTotals {
  incomeDelta: Delta;
  expenseDelta: Delta;
}

/**
 * Variación del balance: porcentaje si el anterior es positivo; diferencia absoluta si el anterior
 * es ≤ 0 (un porcentaje sobre un déficit confunde, research R5); null si ambos son 0.
 */
export type BalanceDelta = { kind: 'pct'; value: Decimal } | { kind: 'abs'; value: Cents } | null;

export interface BalanceReport extends MonthSummary {
  period: Period;
  previousBalance: Cents;
  balanceDelta: BalanceDelta;
}

export interface BalanceEvolutionPoint extends FlowTotals {
  period: Period;
}

function totalsIn(transactions: Transaction[], period: Period): FlowTotals {
  const range = periodRangeUtc(period);
  const within = transactions.filter((t) => isWithin(t.occurredAt, range));
  const income = sum(within.filter(isPersonalIncome).map((t) => t.amount));
  const expense = sum(within.filter(isPersonalExpense).map((t) => t.amount));
  return { income, expense, balance: sub(income, expense) };
}

/** Ingresos, gastos y balance del periodo, con variación vs. el periodo anterior. */
export function monthSummary(transactions: Transaction[], period: Period): MonthSummary {
  const current = totalsIn(transactions, period);
  const previous = totalsIn(transactions, shiftPeriod(period, -1));
  return {
    ...current,
    incomeDelta: delta(current.income, previous.income),
    expenseDelta: delta(current.expense, previous.expense),
  };
}

export function balanceDelta(current: Cents, previous: Cents): BalanceDelta {
  if (current === 0 && previous === 0) return null;
  if (previous <= 0) return { kind: 'abs', value: sub(current, previous) };
  return { kind: 'pct', value: new Decimal(sub(current, previous)).div(previous).mul(100) };
}

export function balanceReport(transactions: Transaction[], period: Period): BalanceReport {
  const summary = monthSummary(transactions, period);
  const previousBalance = totalsIn(transactions, shiftPeriod(period, -1)).balance;
  return { ...summary, period, previousBalance, balanceDelta: balanceDelta(summary.balance, previousBalance) };
}

/** Ingresos, gastos y balance de los últimos `count` periodos, del más antiguo al actual. */
export function balanceEvolution(transactions: Transaction[], period: Period, count = 6): BalanceEvolutionPoint[] {
  return Array.from({ length: count }, (_, i) => {
    const p = shiftPeriod(period, i - (count - 1));
    return { period: p, ...totalsIn(transactions, p) };
  });
}

/** Primer día del mes local del ingreso o gasto personal más antiguo; null si no hay ninguno. */
export function firstActivityMonth(transactions: Transaction[]): IsoDate | null {
  let first: string | null = null;
  for (const t of transactions) {
    if (!isPersonalIncome(t) && !isPersonalExpense(t)) continue;
    if (first === null || Date.parse(t.occurredAt) < Date.parse(first)) first = t.occurredAt;
  }
  if (first === null) return null;
  return `${localDayKey(first).slice(0, 7)}-01`;
}
