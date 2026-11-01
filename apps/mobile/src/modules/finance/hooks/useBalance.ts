import { useMemo } from 'react';

import type { Period } from '@/lib/dates';

import { balanceEvolution, balanceReport } from '../domain/monthSummary';
import { useActiveTransactions } from './useFinanceData';

export function useBalance(period: Period) {
  const transactions = useActiveTransactions();
  const { granularity, anchor } = period;
  return useMemo(() => {
    const p = { granularity, anchor };
    return { report: balanceReport(transactions, p), evolution: balanceEvolution(transactions, p, 6) };
  }, [transactions, granularity, anchor]);
}
