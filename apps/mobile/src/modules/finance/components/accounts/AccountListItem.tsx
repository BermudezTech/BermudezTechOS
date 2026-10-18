import { router } from 'expo-router';
import { memo } from 'react';
import { View } from 'react-native';

import { Amount, AppText, Badge, ListItem } from '@/components/ui';

import type { AccountWithBalance } from '../../domain/accounts';
import { accountIcon, accountTypeMeta } from './accountMeta';

function AccountListItemBase({ item }: { item: AccountWithBalance }) {
  const { account, totalBalance, debt } = item;
  const isCard = debt !== null;
  return (
    <ListItem
      title={account.name}
      subtitle={accountTypeMeta[account.type].label}
      icon={accountIcon(account)}
      iconColor={account.color ?? undefined}
      muted={account.isArchived}
      chevron
      meta={
        account.isArchived || account.isExcludedFromNetWorth ? (
          <>
            {account.isArchived ? <Badge label="Archivada" /> : null}
            {account.isExcludedFromNetWorth ? <Badge label="Fuera del patrimonio" tone="info" /> : null}
          </>
        ) : undefined
      }
      right={
        <View style={{ alignItems: 'flex-end' }}>
          <Amount value={isCard ? debt : totalBalance} variant={isCard ? 'debt' : 'auto'} />
          {isCard ? (
            <AppText variant="caption" tone="muted">
              Deuda
            </AppText>
          ) : null}
        </View>
      }
      onPress={() => router.push(`/finance/accounts/${account.id}`)}
    />
  );
}

export const AccountListItem = memo(AccountListItemBase);
