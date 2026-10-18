import { useMemo } from 'react';

import type { TransactionFilter } from '../data/FinanceRepository';
import type { CategoryKind } from '../domain/types';
import { filterTransactions, groupByLocalDay, periodTotal, recentTransactions } from '../domain/transactions';
import { useActiveCategories, useActiveTransactions } from './useFinanceData';

export { createTransaction, deleteTransaction, setTransactionCategory, updateTransaction } from '../data/inMemory/transactionsRepo';

export function useTransactions(filter: TransactionFilter) {
  const transactions = useActiveTransactions();
  const { accountId, type, categoryId, from, to, search, reimbursementGroupId } = filter;
  return useMemo(() => {
    const filtered = filterTransactions(transactions, { accountId, type, categoryId, from, to, search, reimbursementGroupId });
    return { days: groupByLocalDay(filtered), total: periodTotal(filtered), count: filtered.length };
  }, [transactions, accountId, type, categoryId, from, to, search, reimbursementGroupId]);
}

export function useTransaction(id: string | undefined) {
  const transactions = useActiveTransactions();
  return useMemo(() => transactions.find((t) => t.id === id), [transactions, id]);
}

export function useRecentTransactions(limit: number) {
  const transactions = useActiveTransactions();
  return useMemo(() => recentTransactions(transactions, limit), [transactions, limit]);
}

export function useCategories(kind?: CategoryKind) {
  const categories = useActiveCategories();
  return useMemo(() => (kind ? categories.filter((c) => c.kind === kind) : categories), [categories, kind]);
}
