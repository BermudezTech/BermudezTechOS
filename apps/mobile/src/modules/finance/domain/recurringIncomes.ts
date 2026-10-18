import type { IsoDate } from '@/lib/dates';
import type { Cents } from '@/lib/money';

import type { RecurringIncome, RecurringIncomeCycle, RecurringIncomeStatus, Transaction } from './types';

/** Periodo de un ingreso según la fecha local en que se recibió: `YYYY-MM` (mensual) o `YYYY` (anual). */
export function periodFor(cycle: RecurringIncomeCycle, localDate: IsoDate): string {
  return cycle === 'YEARLY' ? localDate.slice(0, 4) : localDate.slice(0, 7);
}

/** ¿Hay ya un ingreso no borrado de esta plantilla en el periodo? (aviso no bloqueante, FR-010). */
export function hasEntryInPeriod(transactions: Transaction[], recurringIncomeId: string, period: string, excludeId?: string): boolean {
  return transactions.some(
    (t) => !t.deletedAt && t.id !== excludeId && t.recurringIncomeId === recurringIncomeId && t.recurringIncomePeriod === period,
  );
}

export interface RecurringIncomePrefill {
  amount: Cents;
  accountId: string;
  categoryId: string | null;
  description: string;
  date: IsoDate;
}

/** Valores con que se prellena el formulario de ingreso (FR-004). */
export function prefillFrom(recurringIncome: RecurringIncome, today: IsoDate): RecurringIncomePrefill {
  return {
    amount: recurringIncome.expectedAmount,
    accountId: recurringIncome.accountId,
    categoryId: recurringIncome.categoryId,
    description: recurringIncome.name,
    date: today,
  };
}

export function canTransition(from: RecurringIncomeStatus, to: RecurringIncomeStatus): boolean {
  return from !== to;
}

/** Activos primero, luego por nombre. */
export function sortRecurringIncomes(items: RecurringIncome[]): RecurringIncome[] {
  return [...items].sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name, 'es') : a.status === 'ACTIVE' ? -1 : 1));
}
