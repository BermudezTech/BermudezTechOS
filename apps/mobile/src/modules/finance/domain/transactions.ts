import { localDateTimeToUtc, localDayKey, addDays } from '@/lib/dates';
import { sub, sum, type Cents } from '@/lib/money';

import type { TransactionFilter } from '../data/FinanceRepository';
import type { Transaction } from './types';

export interface DayGroup {
  /** "YYYY-MM-DD" local. */
  day: string;
  transactions: Transaction[];
  /** Ingresos − egresos del día (sin transferencias). */
  net: Cents;
}

export interface PeriodTotal {
  income: Cents;
  expense: Cents;
  net: Cents;
}

/** Minúsculas y sin acentos, para búsqueda. */
export function normalizeText(value: string): string {
  // Quita los diacríticos combinantes (U+0300–U+036F) tras descomponer en NFD.
  // prettier-ignore
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/** Aplica todos los filtros (se combinan con Y). Las fechas son días locales inclusivos. */
export function filterTransactions(transactions: Transaction[], filter: TransactionFilter): Transaction[] {
  const from = filter.from ? Date.parse(localDateTimeToUtc(filter.from, 0, 0)) : null;
  const to = filter.to ? Date.parse(localDateTimeToUtc(addDays(filter.to, 1), 0, 0)) : null;
  const search = filter.search ? normalizeText(filter.search) : '';
  return transactions.filter((t) => {
    if (t.deletedAt) return false;
    if (filter.accountId && t.accountId !== filter.accountId && t.counterAccountId !== filter.accountId) return false;
    if (filter.type && t.type !== filter.type) return false;
    if (
      filter.categoryId === 'NONE'
        ? t.categoryId !== null || t.type === 'TRANSFER'
        : filter.categoryId && t.categoryId !== filter.categoryId
    )
      return false;
    if (filter.reimbursementGroupId && t.reimbursementGroupId !== filter.reimbursementGroupId) return false;
    const time = Date.parse(t.occurredAt);
    if (from !== null && time < from) return false;
    if (to !== null && time >= to) return false;
    if (search && !normalizeText(t.description ?? '').includes(search)) return false;
    return true;
  });
}

export function sortByDateDesc(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export function periodTotal(transactions: Transaction[]): PeriodTotal {
  const income = sum(transactions.filter((t) => !t.deletedAt && t.type === 'INCOME').map((t) => t.amount));
  const expense = sum(transactions.filter((t) => !t.deletedAt && t.type === 'EXPENSE').map((t) => t.amount));
  return { income, expense, net: sub(income, expense) };
}

/** Agrupa por día local, del más reciente al más antiguo. */
export function groupByLocalDay(transactions: Transaction[]): DayGroup[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of sortByDateDesc(transactions)) {
    const day = localDayKey(t.occurredAt);
    const list = groups.get(day);
    if (list) list.push(t);
    else groups.set(day, [t]);
  }
  return [...groups.entries()].map(([day, list]) => ({ day, transactions: list, net: periodTotal(list).net }));
}

export function recentTransactions(transactions: Transaction[], limit: number): Transaction[] {
  return sortByDateDesc(transactions.filter((t) => !t.deletedAt)).slice(0, limit);
}
