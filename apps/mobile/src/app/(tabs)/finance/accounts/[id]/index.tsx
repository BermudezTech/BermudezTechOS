import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import {
  Amount,
  AppText,
  Badge,
  Button,
  confirm,
  EmptyState,
  GlassCard,
  IconButton,
  notify,
  NotFound,
  Screen,
  SectionHeader,
} from '@/components/ui';
import { CreditCardPanel } from '@/modules/finance/components/accounts/CreditCardPanel';
import { accountTypeMeta } from '@/modules/finance/components/accounts/accountMeta';
import { PocketList } from '@/modules/finance/components/accounts/PocketList';
import { TransactionListItem } from '@/modules/finance/components/transactions/TransactionListItem';
import { ValidationError } from '@/modules/finance/data/FinanceRepository';
import { archiveAccount, deleteAccount, useAccount, useAccountMap } from '@/modules/finance/hooks/useAccounts';
import { useCategoryMap } from '@/modules/finance/hooks/useFinanceData';
import { sub } from '@/lib/money';
import { useTheme } from '@/theme';

export default function AccountDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useAccount(id);
  const accounts = useAccountMap();
  const categories = useCategoryMap();
  const perspective = useMemo(() => new Set(detail ? [detail.account.id, ...detail.pockets.map((p) => p.account.id)] : []), [detail]);

  if (!detail) {
    return (
      <Screen title="Cuenta" back fallback="/finance/accounts">
        <NotFound />
      </Screen>
    );
  }

  const { account } = detail;
  const isPocket = account.type === 'POCKET';

  const onDelete = async () => {
    const ok = await confirm({
      title: `¿Eliminar "${account.name}"?`,
      message: 'Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteAccount(account.id);
      router.back();
    } catch (error) {
      if (error instanceof ValidationError && error.code === 'HAS_DEPENDENCIES') {
        const archive = await confirm({
          title: 'No se puede eliminar',
          message: 'La cuenta tiene movimientos o cajitas. ¿Quieres archivarla en su lugar? Se ocultará pero conservará su historia.',
          confirmLabel: 'Archivar',
        });
        if (archive) await archiveAccount(account.id, true);
      } else {
        notify('No se pudo eliminar la cuenta');
      }
    }
  };

  return (
    <Screen
      title={account.name}
      subtitle={isPocket && detail.parent ? `Cajita de ${detail.parent.name}` : accountTypeMeta[account.type].label}
      back
      fallback="/finance/accounts"
      right={
        <IconButton
          icon="create-outline"
          accessibilityLabel="Editar cuenta"
          onPress={() => router.push(`/finance/accounts/${account.id}/edit`)}
        />
      }>
      {(account.isArchived || account.isExcludedFromNetWorth) && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {account.isArchived ? <Badge label="Archivada" /> : null}
          {account.isExcludedFromNetWorth ? <Badge label="Fuera del patrimonio" tone="info" /> : null}
        </View>
      )}

      {detail.card ? (
        <CreditCardPanel account={account} metrics={detail.card} />
      ) : (
        <GlassCard>
          <View style={{ gap: theme.spacing(3) }}>
            <View>
              <AppText variant="caption" tone="muted">
                {detail.pockets.length > 0 ? 'Saldo total' : 'Saldo'}
              </AppText>
              <Amount value={detail.totalBalance} size="large" />
            </View>
            {detail.pockets.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(5) }}>
                <View>
                  <AppText variant="caption" tone="muted">
                    Disponible
                  </AppText>
                  <Amount value={detail.availableBalance} />
                </View>
                <View>
                  <AppText variant="caption" tone="muted">
                    Apartado en cajitas
                  </AppText>
                  <Amount value={sub(detail.totalBalance, detail.availableBalance)} />
                </View>
              </View>
            ) : null}
          </View>
        </GlassCard>
      )}

      {!isPocket && account.type !== 'CREDIT_CARD' && account.type !== 'INVESTMENT' ? (
        <>
          <SectionHeader
            title="Cajitas"
            actionLabel="Nueva cajita"
            onAction={() => router.push(`/finance/accounts/new?parentId=${account.id}`)}
          />
          <PocketList pockets={detail.pockets} parentId={account.id} />
        </>
      ) : null}

      {account.type !== 'INVESTMENT' && !account.isArchived ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) }}>
          <Button
            label={account.type === 'CREDIT_CARD' ? 'Pagar tarjeta' : 'Mover dinero'}
            icon="swap-horizontal"
            variant="secondary"
            onPress={() =>
              router.push(
                account.type === 'CREDIT_CARD'
                  ? `/finance/transactions/new?type=TRANSFER`
                  : `/finance/transactions/new?type=TRANSFER&accountId=${account.id}`,
              )
            }
          />
        </View>
      ) : null}

      <SectionHeader
        title="Movimientos recientes"
        actionLabel="Ver todos"
        onAction={() => router.push(`/finance/transactions?accountId=${account.id}`)}
      />
      {detail.recentTransactions.length === 0 ? (
        <EmptyState icon="receipt-outline" title="Sin movimientos" message="Los movimientos de esta cuenta aparecerán aquí." />
      ) : (
        <GlassCard padded={false} style={{ padding: theme.spacing(2) }}>
          {detail.recentTransactions.map((tx) => (
            <TransactionListItem
              key={tx.id}
              tx={tx}
              category={tx.categoryId ? categories.get(tx.categoryId) : undefined}
              accounts={accounts}
              perspective={perspective}
              showDate
            />
          ))}
        </GlassCard>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) }}>
        <Button
          label={account.isArchived ? 'Desarchivar' : 'Archivar'}
          icon="archive-outline"
          variant="secondary"
          onPress={() => archiveAccount(account.id, !account.isArchived)}
        />
        <Button label="Eliminar" icon="trash-outline" variant="danger" onPress={onDelete} />
      </View>
    </Screen>
  );
}
