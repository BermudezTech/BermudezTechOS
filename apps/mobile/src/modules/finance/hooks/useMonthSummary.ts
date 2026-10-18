import { useMemo } from 'react';

import { clampedIsoDate, isoDate, parseIsoDate } from '@/lib/dates';

import { monthSummary } from '../domain/monthSummary';
import { useActiveTransactions, useToday } from './useFinanceData';

/** Ingresos, gastos y balance del mes en curso. */
export function useMonthSummary() {
  const transactions = useActiveTransactions();
  const today = useToday();
  return useMemo(() => monthSummary(transactions, { granularity: 'MONTH', anchor: today }), [transactions, today]);
}

/** Primer y último día (local) del mes en curso, para filtrar Movimientos (`?from=&to=`). */
export function useCurrentMonthRange() {
  const { year, month } = parseIsoDate(useToday());
  return { from: isoDate(year, month, 1), to: clampedIsoDate(year, month, 31) };
}
