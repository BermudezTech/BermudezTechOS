import { useTheme } from '@/theme';

import { useCurrentMonthRange, useMonthSummary } from '../../hooks/useMonthSummary';
import { DeltaText } from '../spending/DeltaText';
import { StatCard } from './StatCard';

/** Abre Movimientos filtrado a ingresos del mes en curso. */
export function MonthIncomeCard() {
  const theme = useTheme();
  const summary = useMonthSummary();
  const range = useCurrentMonthRange();
  return (
    <StatCard
      id="month-income"
      label="Ingresos del mes"
      icon="arrow-down-circle"
      iconColor={theme.colors.income}
      value={summary.income}
      href={{ pathname: '/finance/transactions', params: { ...range, type: 'INCOME' } }}
      footer={<DeltaText delta={summary.incomeDelta} suffix="vs. mes anterior" goodWhen="up" />}
    />
  );
}
