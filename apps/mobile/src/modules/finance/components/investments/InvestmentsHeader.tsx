import { View } from 'react-native';

import { Amount, AppText, GlassCard } from '@/components/ui';
import { formatPercent } from '@/lib/money';
import { useTheme } from '@/theme';

import type { CdtSummary } from '../../domain/cdts';

export function InvestmentsHeader({ summary }: { summary: CdtSummary }) {
  const theme = useTheme();
  return (
    <GlassCard>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(5), justifyContent: 'space-between' }}>
        <View>
          <AppText variant="caption" tone="muted">
            Total invertido
          </AppText>
          <Amount value={summary.totalInvested} size="large" />
          <AppText variant="caption" tone="muted">
            {summary.activeCount} {summary.activeCount === 1 ? 'CDT activo' : 'CDTs activos'}
          </AppText>
        </View>
        <View>
          <AppText variant="caption" tone="muted">
            Rendimiento promedio
          </AppText>
          <AppText variant="amountLarge" tone="income">
            {formatPercent(summary.weightedRate, 2)}
          </AppText>
          <AppText variant="caption" tone="muted">
            E.A. ponderado
          </AppText>
        </View>
      </View>
    </GlassCard>
  );
}
