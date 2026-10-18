import { View } from 'react-native';

import { Amount, AppText, GlassCard } from '@/components/ui';
import type { Cents } from '@/lib/money';
import { useTheme } from '@/theme';

export function GroupsSummaryHeader({ owedToMe, heldForOthers }: { owedToMe: Cents; heldForOthers: Cents }) {
  const theme = useTheme();
  return (
    <GlassCard>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(5), justifyContent: 'space-between' }}>
        <View>
          <AppText variant="caption" tone="muted">
            Te deben
          </AppText>
          <Amount value={owedToMe} variant="debt" size="large" />
          <AppText variant="caption" tone="muted">
            Pendiente por cobrar
          </AppText>
        </View>
        <View>
          <AppText variant="caption" tone="muted">
            Tienes de terceros
          </AppText>
          <Amount value={heldForOthers} variant="transfer" size="large" />
          <AppText variant="caption" tone="muted">
            Por gastar o devolver
          </AppText>
        </View>
      </View>
    </GlassCard>
  );
}
