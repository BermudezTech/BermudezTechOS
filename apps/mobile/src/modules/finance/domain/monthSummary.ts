import { isWithin, periodRangeUtc, shiftPeriod, type Period } from '@/lib/dates';
import { sub, sum, type Cents } from '@/lib/money';

import { delta, isPersonalExpense, type Delta } from './spending';
import type { Transaction } from './types';

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

/** Ingreso personal = INCOME sin grupo de reembolso (simétrico a `isPersonalExpense`). */
export function isPersonalIncome(t: Transaction): boolean {
  return !t.deletedAt && t.type === 'INCOME' && t.reimbursementGroupId === null;
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
