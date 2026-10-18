import { View } from 'react-native';

import { Amount, AppText, GlassCard } from '@/components/ui';
import { useTheme } from '@/theme';

import type { NetWorthReport } from '../../domain/netWorth';

export function NetWorthHeader({ report }: { report: NetWorthReport }) {
  const theme = useTheme();
  return (
    <GlassCard>
      <View style={{ gap: theme.spacing(3) }}>
        <View>
          <AppText variant="caption" tone="muted">
            Patrimonio neto
          </AppText>
          <Amount value={report.netWorth} size="large" />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(5) }}>
          <View>
            <AppText variant="caption" tone="muted">
              Activos
            </AppText>
            <Amount value={report.assetsTotal} />
          </View>
          <View>
            <AppText variant="caption" tone="muted">
              Pasivos
            </AppText>
            <Amount value={report.liabilitiesTotal} variant="debt" />
          </View>
        </View>
      </View>
    </GlassCard>
  );
}
