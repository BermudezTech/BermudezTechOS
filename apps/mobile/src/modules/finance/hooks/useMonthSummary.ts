import { useMemo } from 'react';

import { monthSummary } from '../domain/monthSummary';
import { useActiveTransactions, useToday } from './useFinanceData';

/** Ingresos, gastos y balance del mes en curso. */
export function useMonthSummary() {
  const transactions = useActiveTransactions();
  const today = useToday();
  return useMemo(() => monthSummary(transactions, { granularity: 'MONTH', anchor: today }), [transactions, today]);
}
