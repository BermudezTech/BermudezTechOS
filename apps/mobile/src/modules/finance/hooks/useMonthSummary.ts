import { useMemo } from 'react';

import type { IsoDate, Period } from '@/lib/dates';

import { firstActivityMonth, monthSummary } from '../domain/monthSummary';
import { useActiveTransactions, useToday } from './useFinanceData';

/** Ingresos, gastos y balance del periodo; sin argumento, del mes en curso. */
export function useMonthSummary(period?: Period) {
  const transactions = useActiveTransactions();
  const today = useToday();
  const granularity = period?.granularity ?? 'MONTH';
  const anchor = period?.anchor ?? today;
  return useMemo(() => monthSummary(transactions, { granularity, anchor }), [transactions, granularity, anchor]);
}

/** Primer mes con ingresos o gastos personales; límite inferior de los selectores de periodo. */
export function useFirstActivityMonth(): IsoDate | null {
  const transactions = useActiveTransactions();
  return useMemo(() => firstActivityMonth(transactions), [transactions]);
}
