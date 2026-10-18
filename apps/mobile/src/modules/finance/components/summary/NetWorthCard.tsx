import { useTheme } from '@/theme';

import { useNetWorth } from '../../hooks/useNetWorth';
import { StatCard } from './StatCard';

export function NetWorthCard() {
  const theme = useTheme();
  const { report } = useNetWorth();
  return (
    <StatCard
      id="net-worth"
      label="Patrimonio neto"
      icon="analytics"
      iconColor={theme.colors.accentAlt}
      value={report.netWorth}
      variant="auto"
      href="/finance/net-worth"
    />
  );
}
