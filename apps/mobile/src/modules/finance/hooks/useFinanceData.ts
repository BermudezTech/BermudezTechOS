import { useMemo } from 'react';

import { todayLocal } from '@/lib/dates';

import { activeList, useFinanceStore } from '../data/local/store';
import { balancesByAccount } from '../domain/balances';

/** Listas activas (sin borrados) memoizadas por entidad. */
export function useActiveAccounts() {
  const records = useFinanceStore((s) => s.accounts);
  return useMemo(() => activeList(records), [records]);
}

export function useActiveTransactions() {
  const records = useFinanceStore((s) => s.transactions);
  return useMemo(() => activeList(records), [records]);
}

export function useActiveCategories() {
  const records = useFinanceStore((s) => s.categories);
  return useMemo(() => activeList(records).sort((a, b) => a.sortOrder - b.sortOrder), [records]);
}

export function useActiveCdts() {
  const records = useFinanceStore((s) => s.cdts);
  return useMemo(() => activeList(records), [records]);
}

export function useActiveSubscriptions() {
  const records = useFinanceStore((s) => s.subscriptions);
  return useMemo(() => activeList(records), [records]);
}

export function useActiveRecurringIncomes() {
  const records = useFinanceStore((s) => s.recurringIncomes);
  return useMemo(() => activeList(records), [records]);
}

export function useActiveGroups() {
  const records = useFinanceStore((s) => s.reimbursementGroups);
  return useMemo(() => activeList(records), [records]);
}

export function useActiveAssets() {
  const records = useFinanceStore((s) => s.assets);
  return useMemo(() => activeList(records), [records]);
}

/** Saldos con signo de todas las cuentas, recalculados cuando cambian cuentas o movimientos (FR-033). */
export function useBalances() {
  const accounts = useActiveAccounts();
  const transactions = useActiveTransactions();
  return useMemo(() => balancesByAccount(accounts, transactions), [accounts, transactions]);
}

/** Día local de hoy (estable durante el render). */
export function useToday() {
  return useMemo(() => todayLocal(), []);
}

/** Mapa id → categoría. */
export function useCategoryMap() {
  const categories = useActiveCategories();
  return useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
}
