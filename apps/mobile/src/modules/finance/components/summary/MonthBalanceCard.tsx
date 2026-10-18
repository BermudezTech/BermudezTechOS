import { useTheme } from '@/theme';

import { useMonthSummary } from '../../hooks/useMonthSummary';
import { StatCard } from './StatCard';

/** Ingresos − gastos del mes; negativo se muestra en color de egreso. */
export function MonthBalanceCard() {
  const theme = useTheme();
  const summary = useMonthSummary();
  return (
    <StatCard
      id="month-balance"
      label="Balance del mes"
      icon="swap-vertical"
      iconColor={theme.colors.transfer}
      value={summary.balance}
      variant="auto"
      href="/finance/transactions"
    />
  );
}
