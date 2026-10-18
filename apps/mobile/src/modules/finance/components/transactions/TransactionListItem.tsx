import { router } from 'expo-router';
import { memo } from 'react';
import { View } from 'react-native';

import { Amount, AppText, Badge, IconBadge, ListItem, type IconName } from '@/components/ui';
import { formatDateLocal } from '@/lib/dates';
import { useTheme } from '@/theme';

import type { Account, Category, Transaction } from '../../domain/types';

type Props = {
  tx: Transaction;
  category?: Category;
  accounts: Map<string, Account>;
  /** Cuentas desde cuya perspectiva se muestra (detalle de cuenta): define el signo de transferencias. */
  perspective?: Set<string>;
  showDate?: boolean;
};

function TransactionListItemBase({ tx, category, accounts, perspective, showDate }: Props) {
  const theme = useTheme();
  const account = accounts.get(tx.accountId);
  const counter = tx.counterAccountId ? accounts.get(tx.counterAccountId) : undefined;

  let variant: 'income' | 'expense' | 'transfer' = tx.type === 'INCOME' ? 'income' : tx.type === 'EXPENSE' ? 'expense' : 'transfer';
  if (tx.type === 'TRANSFER' && perspective) {
    const incoming = tx.counterAccountId !== null && perspective.has(tx.counterAccountId) && !perspective.has(tx.accountId);
    const outgoing = perspective.has(tx.accountId) && !(tx.counterAccountId && perspective.has(tx.counterAccountId));
    if (incoming) variant = 'income';
    else if (outgoing) variant = 'expense';
  }

  const icon: IconName =
    tx.type === 'TRANSFER'
      ? 'swap-horizontal'
      : ((category?.icon as IconName | null) ?? (tx.type === 'INCOME' ? 'arrow-down' : 'help-circle-outline'));
  const color = tx.type === 'TRANSFER' ? theme.colors.transfer : (category?.color ?? theme.colors.textMuted);
  const title = tx.description || category?.name || (tx.type === 'TRANSFER' ? 'Transferencia' : 'Movimiento');
  const where = tx.type === 'TRANSFER' ? `${account?.name ?? '—'} → ${counter?.name ?? '—'}` : (account?.name ?? '—');
  const subtitle = [
    tx.type === 'TRANSFER' ? null : (category?.name ?? 'Sin categoría'),
    where,
    showDate ? formatDateLocal(tx.occurredAt, 'd MMM') : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <ListItem
      title={title}
      subtitle={subtitle}
      left={<IconBadge name={icon} color={color} />}
      meta={
        tx.categorySource === 'AI' || tx.reimbursementGroupId ? (
          <>
            {tx.categorySource === 'AI' ? <Badge label="Sugerida por IA" tone="accent" icon="sparkles" /> : null}
            {tx.reimbursementGroupId ? <Badge label="Terceros" tone="info" icon="briefcase-outline" /> : null}
          </>
        ) : undefined
      }
      right={
        <View style={{ alignItems: 'flex-end' }}>
          <Amount value={tx.amount} variant={variant} />
          {variant === 'transfer' ? (
            <AppText variant="caption" tone="muted">
              Transferencia
            </AppText>
          ) : null}
        </View>
      }
      onPress={() => router.push(`/finance/transactions/${tx.id}`)}
      accessibilityLabel={`${title}, ${subtitle}`}
    />
  );
}

export const TransactionListItem = memo(TransactionListItemBase);
