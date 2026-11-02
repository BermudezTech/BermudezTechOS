import { useMemo } from 'react';

import { monthSummary } from '../domain/monthSummary';
import { netWorthMonthDelta } from '../domain/netWorth';
import { upcomingItems } from '../domain/upcoming';
import {
  useActiveAccounts,
  useActiveCdts,
  useActiveSubscriptions,
  useActiveTransactions,
  useBalances,
  useLiveToday,
} from './useFinanceData';
import { useNetWorth } from './useNetWorth';

/** Patrimonio para el widget de Inicio: valor, 12 meses y variación vs. el mes anterior (spec 010, US1). */
export function useHomeNetWorth() {
  const today = useLiveToday();
  const { report, evolution } = useNetWorth('12M', today);
  return {
    netWorth: report.netWorth,
    evolution,
    monthDelta: netWorthMonthDelta(evolution),
    // Sin cuentas, CDTs ni bienes no hay grupos en el reporte.
    isEmpty: report.groups.length === 0,
  };
}

/**
 * Ingresos, gastos y balance del mes en curso para Inicio (spec 010, US2). Siempre el mes en
 * curso: no lee el mes elegido en Finanzas → Resumen (FR-014).
 */
export function useHomeMonthFlow() {
  const today = useLiveToday();
  const transactions = useActiveTransactions();
  const summary = useMemo(() => monthSummary(transactions, { granularity: 'MONTH', anchor: today }), [transactions, today]);
  return { month: today, income: summary.income, expense: summary.expense, balance: summary.balance, hasData: transactions.length > 0 };
}

/** Próximos vencimientos (suscripciones, CDTs y tarjetas) para Inicio (spec 010, US4). */
export function useUpcoming() {
  const today = useLiveToday();
  const subscriptions = useActiveSubscriptions();
  const cdts = useActiveCdts();
  const accounts = useActiveAccounts();
  const balances = useBalances();
  return useMemo(() => upcomingItems({ subscriptions, cdts, accounts, balances }, today), [subscriptions, cdts, accounts, balances, today]);
}
