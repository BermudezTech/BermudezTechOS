import { useTheme } from '@/theme';

import { useCurrentMonthRange, useMonthSummary } from '../../hooks/useMonthSummary';
import { StatCard } from './StatCard';

/** Ingresos − gastos del mes; negativo se muestra en color de egreso. Abre Movimientos filtrado al mes. */
export function MonthBalanceCard() {
  const theme = useTheme();
  const summary = useMonthSummary();
  const range = useCurrentMonthRange();
  return (
    <StatCard
      id="month-balance"
      label="Balance del mes"
      icon="swap-vertical"
      iconColor={theme.colors.transfer}
      value={summary.balance}
      variant="auto"
      href={{
        pathname: '/finance/transactions',
        params: range,
      }}
    />
  );
}
