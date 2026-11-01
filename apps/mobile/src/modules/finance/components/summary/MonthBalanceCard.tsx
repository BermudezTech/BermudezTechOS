import { useMemo } from 'react';

import { useTheme } from '@/theme';

import { balanceReport } from '../../domain/monthSummary';
import { useActiveTransactions } from '../../hooks/useFinanceData';
import { useSummaryMonth } from '../../hooks/useSummaryMonth';
import { BalanceDeltaText } from '../balance/BalanceDeltaText';
import { StatCard } from './StatCard';
import { statLabel } from './statLabel';

/** Ingresos − gastos del mes elegido; negativo se muestra en color de egreso. Abre Balance en ese mes. */
export function MonthBalanceCard() {
  const theme = useTheme();
  const { month, isCurrent } = useSummaryMonth();
  const transactions = useActiveTransactions();
  const report = useMemo(() => balanceReport(transactions, { granularity: 'MONTH', anchor: month }), [transactions, month]);
  return (
    <StatCard
      id="month-balance"
      label={statLabel('Balance', month, isCurrent)}
      icon="swap-vertical"
      iconColor={theme.colors.transfer}
      value={report.balance}
      variant="auto"
      href={{ pathname: '/finance/balance', params: { granularity: 'MONTH', anchor: month } }}
      footer={<BalanceDeltaText delta={report.balanceDelta} suffix="vs. mes anterior" />}
    />
  );
}
