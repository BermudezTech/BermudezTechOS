import { router } from 'expo-router';
import { View } from 'react-native';

import { Amount, AppText, EmptyState, GlassCard, IconButton, Screen, SectionHeader } from '@/components/ui';
import { SubscriptionListItem } from '@/modules/finance/components/subscriptions/SubscriptionListItem';
import type { SubscriptionStatus } from '@/modules/finance/domain/types';
import { useAccountMap } from '@/modules/finance/hooks/useAccounts';
import { useSubscriptions } from '@/modules/finance/hooks/useSubscriptions';
import { useTheme } from '@/theme';

const sections: { status: SubscriptionStatus; title: string }[] = [
  { status: 'ACTIVE', title: 'Activas' },
  { status: 'PAUSED', title: 'Pausadas' },
  { status: 'CANCELLED', title: 'Canceladas' },
];

export default function SubscriptionsScreen() {
  const theme = useTheme();
  const { items, monthlyEquivalent } = useSubscriptions();
  const accounts = useAccountMap();
  return (
    <Screen
      title="Suscripciones"
      subtitle="Gastos fijos recurrentes"
      back
      right={<IconButton icon="add" accessibilityLabel="Nueva suscripción" onPress={() => router.push('/finance/subscriptions/new')} />}>
      {items.length === 0 ? (
        <EmptyState
          icon="repeat-outline"
          title="Sin suscripciones"
          message="Registra tus gastos fijos (streaming, gimnasio, hosting…)."
          actionLabel="Nueva suscripción"
          onAction={() => router.push('/finance/subscriptions/new')}
        />
      ) : (
        <>
          <GlassCard>
            <AppText variant="caption" tone="muted">
              Total mensual equivalente
            </AppText>
            <Amount value={monthlyEquivalent} size="large" hideZeroCents={false} />
            <AppText variant="caption" tone="muted">
              Solo activas · las anuales se prorratean entre 12
            </AppText>
          </GlassCard>
          {sections.map(({ status, title }) => {
            const list = items.filter((i) => i.subscription.status === status);
            if (list.length === 0) return null;
            return (
              <View key={status} style={{ gap: theme.spacing(3) }}>
                <SectionHeader title={title} />
                <GlassCard padded={false} style={{ padding: theme.spacing(2) }}>
                  {list.map((item) => (
                    <SubscriptionListItem key={item.subscription.id} item={item} accounts={accounts} />
                  ))}
                </GlassCard>
              </View>
            );
          })}
        </>
      )}
    </Screen>
  );
}
