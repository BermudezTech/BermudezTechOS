import { useTheme } from '@/theme';

import { useMonthSummary } from '../../hooks/useMonthSummary';
import { useSummaryMonth } from '../../hooks/useSummaryMonth';
import { DeltaText } from '../spending/DeltaText';
import { StatCard } from './StatCard';
import { statLabel } from './statLabel';

/** Ingresos del mes elegido en el Resumen; abre Ingresos por categoría en ese mes. */
export function MonthIncomeCard() {
  const theme = useTheme();
  const { month, isCurrent } = useSummaryMonth();
  const summary = useMonthSummary({ granularity: 'MONTH', anchor: month });
  return (
    <StatCard
      id="month-income"
      label={statLabel('Ingresos', month, isCurrent)}
      icon="arrow-down-circle"
      iconColor={theme.colors.income}
      value={summary.income}
      href={{ pathname: '/finance/income', params: { granularity: 'MONTH', anchor: month } }}
      footer={<DeltaText delta={summary.incomeDelta} suffix="vs. mes anterior" goodWhen="up" />}
    />
  );
}
