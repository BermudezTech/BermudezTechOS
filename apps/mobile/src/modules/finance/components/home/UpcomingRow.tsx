import { router, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Amount, AppText, IconBadge, type IconName } from '@/components/ui';
import { formatCop } from '@/lib/money';
import { formatDateLocal } from '@/lib/dates';
import { useTheme } from '@/theme';

import { daysUntilLabel, type UpcomingItem, type UpcomingKind } from '../../domain/upcoming';
import { HIDDEN_AMOUNT } from './WidgetHeader';

const ICONS: Record<UpcomingKind, IconName> = {
  CARD_PAYMENT: 'card-outline',
  CDT_MATURITY: 'trending-up-outline',
  SUBSCRIPTION: 'repeat-outline',
};

/** Destino de cada tipo (contracts/navigation.md); las suscripciones no tienen detalle, se editan. */
function hrefFor(item: UpcomingItem): Href {
  switch (item.kind) {
    case 'SUBSCRIPTION':
      return `/finance/subscriptions/${item.sourceId}/edit`;
    case 'CDT_MATURITY':
      return `/finance/investments/${item.sourceId}`;
    case 'CARD_PAYMENT':
      return `/finance/accounts/${item.sourceId}`;
  }
}

export function UpcomingRow({ item, visible }: { item: UpcomingItem; visible: boolean }) {
  const theme = useTheme();
  const days = daysUntilLabel(item.daysUntil);
  const tone = item.overdue ? 'danger' : item.urgent ? 'warning' : 'muted';
  return (
    <Pressable
      onPress={() => router.push(hrefFor(item))}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${days}, ${visible ? formatCop(item.amount) : 'monto oculto'}`}
      style={({ pressed }) => ({
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing(3),
        paddingVertical: theme.spacing(2),
        paddingHorizontal: theme.spacing(2),
        borderRadius: theme.radii.md,
        backgroundColor: pressed ? theme.colors.surfacePressed : 'transparent',
      })}>
      <IconBadge name={ICONS[item.kind]} size={36} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {item.name}
        </AppText>
        <AppText variant="caption" tone={tone} numberOfLines={1}>
          {days} · {formatDateLocal(item.date, "d 'de' MMM")}
        </AppText>
      </View>
      {visible ? <Amount value={item.amount} variant="default" /> : <AppText variant="amount">{HIDDEN_AMOUNT}</AppText>}
    </Pressable>
  );
}
