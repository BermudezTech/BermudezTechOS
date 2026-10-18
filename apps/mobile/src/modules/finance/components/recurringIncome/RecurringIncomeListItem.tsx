import { router } from 'expo-router';
import { memo } from 'react';
import { View } from 'react-native';

import { Amount, AppText, Badge, IconBadge, ListItem, type IconName } from '@/components/ui';
import { formatDateLocal, isoDate } from '@/lib/dates';

import type { Account, RecurringIncome } from '../../domain/types';

function scheduleLabel(r: RecurringIncome): string {
  if (r.cycle === 'MONTHLY') return `Mensual · día ${r.expectedDay}`;
  const month = r.expectedMonth ? formatDateLocal(isoDate(2026, r.expectedMonth, 1), 'MMMM') : '';
  return `Anual · ${r.expectedDay} de ${month}`;
}

function RecurringIncomeListItemBase({ item, accounts }: { item: RecurringIncome; accounts: Map<string, Account> }) {
  const paused = item.status === 'PAUSED';
  return (
    <ListItem
      title={item.name}
      subtitle={`${scheduleLabel(item)} · ${accounts.get(item.accountId)?.name ?? '—'}`}
      left={<IconBadge name={(item.icon as IconName | null) ?? 'cash-outline'} />}
      muted={paused}
      meta={paused ? <Badge label="Pausado" tone="warning" /> : undefined}
      right={
        <View style={{ alignItems: 'flex-end' }}>
          <Amount value={item.expectedAmount} variant="income" />
          <AppText variant="caption" tone="muted">
            {item.cycle === 'MONTHLY' ? '/ mes' : '/ año'}
          </AppText>
        </View>
      }
      chevron
      onPress={() => router.push(`/finance/recurring-income/${item.id}/edit`)}
    />
  );
}

export const RecurringIncomeListItem = memo(RecurringIncomeListItemBase);
