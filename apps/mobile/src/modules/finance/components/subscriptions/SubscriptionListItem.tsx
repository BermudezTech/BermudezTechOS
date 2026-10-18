import { router } from 'expo-router';
import { memo } from 'react';
import { View } from 'react-native';

import { Amount, AppText, Badge, Button, confirm, IconBadge, ListItem, type BadgeTone, type IconName } from '@/components/ui';
import { formatDateLocal } from '@/lib/dates';
import { useTheme } from '@/theme';

import type { SubscriptionWithNext } from '../../domain/subscriptions';
import type { Account, SubscriptionStatus } from '../../domain/types';
import { setSubscriptionStatus } from '../../hooks/useSubscriptions';

const statusMeta: Record<SubscriptionStatus, { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: 'Activa', tone: 'success' },
  PAUSED: { label: 'Pausada', tone: 'warning' },
  CANCELLED: { label: 'Cancelada', tone: 'neutral' },
};

function nextLabel(item: SubscriptionWithNext): string {
  if (!item.nextBilling) return statusMeta[item.subscription.status].label;
  if (item.daysUntil === 0) return 'Cobra hoy';
  if (item.daysUntil === 1) return 'Cobra mañana';
  return `Próximo cobro: ${formatDateLocal(item.nextBilling, "d 'de' MMM")}`;
}

function SubscriptionListItemBase({ item, accounts }: { item: SubscriptionWithNext; accounts: Map<string, Account> }) {
  const theme = useTheme();
  const sub = item.subscription;
  const status = statusMeta[sub.status];
  const cancel = async () => {
    if (
      await confirm({
        title: `¿Cancelar ${sub.name}?`,
        message: 'Una suscripción cancelada no se puede reactivar.',
        confirmLabel: 'Cancelar suscripción',
        destructive: true,
      })
    ) {
      await setSubscriptionStatus(sub.id, 'CANCELLED');
    }
  };
  return (
    <View style={{ gap: theme.spacing(1.5), paddingBottom: theme.spacing(2) }}>
      <ListItem
        title={sub.name}
        subtitle={`${sub.billingCycle === 'MONTHLY' ? 'Mensual' : 'Anual'} · ${accounts.get(sub.accountId)?.name ?? '—'}`}
        left={<IconBadge name={(sub.icon as IconName | null) ?? 'repeat-outline'} />}
        muted={sub.status !== 'ACTIVE'}
        meta={
          <Badge
            label={nextLabel(item)}
            tone={sub.status === 'ACTIVE' ? (item.daysUntil !== null && item.daysUntil <= 3 ? 'warning' : 'info') : status.tone}
          />
        }
        right={
          <View style={{ alignItems: 'flex-end' }}>
            <Amount value={sub.amount} />
            <AppText variant="caption" tone="muted">
              {sub.billingCycle === 'MONTHLY' ? '/ mes' : '/ año'}
            </AppText>
          </View>
        }
        chevron={sub.status !== 'CANCELLED'}
        onPress={sub.status !== 'CANCELLED' ? () => router.push(`/finance/subscriptions/${sub.id}/edit`) : undefined}
      />
      {sub.status !== 'CANCELLED' ? (
        <View style={{ flexDirection: 'row', gap: theme.spacing(2), paddingLeft: 56 }}>
          {sub.status === 'ACTIVE' ? (
            <Button label="Pausar" icon="pause" variant="secondary" compact onPress={() => setSubscriptionStatus(sub.id, 'PAUSED')} />
          ) : (
            <Button label="Reanudar" icon="play" variant="secondary" compact onPress={() => setSubscriptionStatus(sub.id, 'ACTIVE')} />
          )}
          <Button label="Cancelar" icon="close" variant="ghost" compact onPress={cancel} accessibilityLabel={`Cancelar ${sub.name}`} />
        </View>
      ) : null}
    </View>
  );
}

export const SubscriptionListItem = memo(SubscriptionListItemBase);
