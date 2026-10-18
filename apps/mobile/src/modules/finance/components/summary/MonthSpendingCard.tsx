import { useTheme } from '@/theme';

import { useMonthSummary } from '../../hooks/useMonthSummary';
import { DeltaText } from '../spending/DeltaText';
import { StatCard } from './StatCard';

export function MonthSpendingCard() {
  const theme = useTheme();
  const summary = useMonthSummary();
  return (
    <StatCard
      id="month-spending"
      label="Gastos del mes"
      icon="pie-chart"
      iconColor={theme.colors.expense}
      value={summary.expense}
      href="/finance/spending"
      footer={<DeltaText delta={summary.expenseDelta} suffix="vs. mes anterior" />}
    />
  );
}
