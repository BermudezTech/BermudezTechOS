import { useMemo } from 'react';

import type { Period } from '@/lib/dates';

import { categoryTransactions, spendingEvolution, spendingReport } from '../domain/spending';
import { useActiveTransactions, useCategoryMap } from './useFinanceData';

export function useSpendingByCategory(period: Period) {
  const transactions = useActiveTransactions();
  const categories = useCategoryMap();
  const { granularity, anchor } = period;
  return useMemo(() => {
    const p = { granularity, anchor };
    return { report: spendingReport(transactions, categories, p), evolution: spendingEvolution(transactions, p, 6) };
  }, [transactions, categories, granularity, anchor]);
}

export function useCategorySpending(categoryId: string | null, period: Period) {
  const transactions = useActiveTransactions();
  const { granularity, anchor } = period;
  return useMemo(
    () => categoryTransactions(transactions, categoryId, { granularity, anchor }),
    [transactions, categoryId, granularity, anchor],
  );
}
