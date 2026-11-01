import { useTheme } from '@/theme';

import { useMonthSummary } from '../../hooks/useMonthSummary';
import { useSummaryMonth } from '../../hooks/useSummaryMonth';
import { DeltaText } from '../spending/DeltaText';
import { StatCard } from './StatCard';
import { statLabel } from './statLabel';

/** Gastos del mes elegido en el Resumen; abre Gastos por categoría en ese mes. */
export function MonthSpendingCard() {
  const theme = useTheme();
  const { month, isCurrent } = useSummaryMonth();
  const summary = useMonthSummary({ granularity: 'MONTH', anchor: month });
  return (
    <StatCard
      id="month-spending"
      label={statLabel('Gastos', month, isCurrent)}
      icon="pie-chart"
      iconColor={theme.colors.expense}
      value={summary.expense}
      href={{ pathname: '/finance/spending', params: { granularity: 'MONTH', anchor: month } }}
      footer={<DeltaText delta={summary.expenseDelta} suffix="vs. mes anterior" />}
    />
  );
}
