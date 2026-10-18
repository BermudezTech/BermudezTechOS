import { router } from 'expo-router';
import { memo } from 'react';
import { View } from 'react-native';

import { Amount, AppText, Badge, ListItem } from '@/components/ui';
import { formatDateLocal } from '@/lib/dates';

import type { CdtValues } from '../../domain/cdts';
import { cdtStatusLabels, formatRate } from './labels';

function CdtListItemBase({ item }: { item: CdtValues }) {
  const { cdt } = item;
  const active = cdt.status === 'ACTIVE';
  return (
    <ListItem
      title={cdt.issuer}
      subtitle={`${formatRate(cdt.annualRateEa)} E.A. · vence ${formatDateLocal(cdt.maturesOn, "d 'de' MMM yyyy")}`}
      icon="trending-up-outline"
      muted={!active}
      meta={
        item.maturingSoon ? (
          <Badge
            label={item.daysRemaining === 0 ? 'Vence hoy' : `Vence en ${item.daysRemaining} días`}
            tone="warning"
            icon="time-outline"
          />
        ) : !active ? (
          <Badge label={cdtStatusLabels[cdt.status]} />
        ) : undefined
      }
      right={
        <View style={{ alignItems: 'flex-end' }}>
          <Amount value={cdt.principal} />
          <AppText variant="caption" tone="muted">
            Capital
          </AppText>
        </View>
      }
      chevron
      onPress={() => router.push(`/finance/investments/${cdt.id}`)}
    />
  );
}

export const CdtListItem = memo(CdtListItemBase);
