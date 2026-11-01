import { useMemo } from 'react';

import type { Period } from '@/lib/dates';

import { categoryFlowEvolution, categoryFlowReport, categoryFlowTransactions } from '../domain/spending';
import { useActiveTransactions, useCategoryMap } from './useFinanceData';

export function useIncomeByCategory(period: Period) {
  const transactions = useActiveTransactions();
  const categories = useCategoryMap();
  const { granularity, anchor } = period;
  return useMemo(() => {
    const p = { granularity, anchor };
    return {
      report: categoryFlowReport(transactions, categories, p, 'INCOME'),
      evolution: categoryFlowEvolution(transactions, p, 'INCOME', 6),
    };
  }, [transactions, categories, granularity, anchor]);
}

export function useCategoryIncome(categoryId: string | null, period: Period) {
  const transactions = useActiveTransactions();
  const { granularity, anchor } = period;
  return useMemo(
    () => categoryFlowTransactions(transactions, categoryId, { granularity, anchor }, 'INCOME'),
    [transactions, categoryId, granularity, anchor],
  );
}
