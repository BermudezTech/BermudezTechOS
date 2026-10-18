import { useTheme } from '@/theme';

import { useMonthSummary } from '../../hooks/useMonthSummary';
import { DeltaText } from '../spending/DeltaText';
import { StatCard } from './StatCard';

export function MonthIncomeCard() {
  const theme = useTheme();
  const summary = useMonthSummary();
  return (
    <StatCard
      id="month-income"
      label="Ingresos del mes"
      icon="arrow-down-circle"
      iconColor={theme.colors.income}
      value={summary.income}
      href="/finance/transactions"
      footer={<DeltaText delta={summary.incomeDelta} suffix="vs. mes anterior" goodWhen="up" />}
    />
  );
}
