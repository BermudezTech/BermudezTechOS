import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import {
  Amount,
  AppText,
  Badge,
  Button,
  confirm,
  FormField,
  GlassCard,
  IconBadge,
  IconButton,
  NotFound,
  Screen,
  Select,
  type IconName,
} from '@/components/ui';
import { formatDateLocal } from '@/lib/dates';
import { useAccountMap } from '@/modules/finance/hooks/useAccounts';
import { useActiveGroups, useCategoryMap } from '@/modules/finance/hooks/useFinanceData';
import { deleteTransaction, setTransactionCategory, useCategories, useTransaction } from '@/modules/finance/hooks/useTransactions';
import { useTheme } from '@/theme';

const typeLabels = { INCOME: 'Ingreso', EXPENSE: 'Egreso', TRANSFER: 'Transferencia' } as const;

export default function TransactionDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tx = useTransaction(id);
  const accounts = useAccountMap();
  const categoryMap = useCategoryMap();
  const groups = useActiveGroups();
  const [changing, setChanging] = useState(false);
  const kindCategories = useCategories(tx?.type === 'INCOME' ? 'INCOME' : 'EXPENSE');

  if (!tx) {
    return (
      <Screen title="Movimiento" back fallback="/finance/transactions">
        <NotFound />
      </Screen>
    );
  }

  const category = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;
  const account = accounts.get(tx.accountId);
  const counter = tx.counterAccountId ? accounts.get(tx.counterAccountId) : undefined;
  const group = groups.find((g) => g.id === tx.reimbursementGroupId);
  const isAi = tx.categorySource === 'AI';
  const variant = tx.type === 'INCOME' ? 'income' : tx.type === 'EXPENSE' ? 'expense' : 'transfer';

  const onDelete = async () => {
    const ok = await confirm({
      title: '¿Eliminar este movimiento?',
      message: 'Los saldos se recalcularán.',
      confirmLabel: 'Eliminar',
      destructive: true,
    });
    if (!ok) return;
    await deleteTransaction(tx.id);
    if (router.canDismiss()) router.dismiss();
    else router.replace('/finance/transactions');
  };

  return (
    <Screen
      title={tx.description || category?.name || typeLabels[tx.type]}
      subtitle={typeLabels[tx.type]}
      back
      fallback="/finance/transactions"
      right={
        <IconButton
          icon="create-outline"
          accessibilityLabel="Editar movimiento"
          onPress={() => router.push(`/finance/transactions/${tx.id}/edit`)}
        />
      }>
      <GlassCard>
        <View style={{ alignItems: 'center', gap: theme.spacing(2), paddingVertical: theme.spacing(2) }}>
          <IconBadge
            name={tx.type === 'TRANSFER' ? 'swap-horizontal' : ((category?.icon as IconName | null) ?? 'help-circle-outline')}
            color={tx.type === 'TRANSFER' ? theme.colors.transfer : (category?.color ?? undefined)}
            size={56}
          />
          <Amount value={tx.amount} variant={variant} size="large" hideZeroCents={false} />
          <AppText tone="muted">{formatDateLocal(tx.occurredAt, "EEEE d 'de' MMMM 'de' yyyy, h:mm a")}</AppText>
        </View>
      </GlassCard>

      <GlassCard>
        <View style={{ gap: theme.spacing(3) }}>
          <Row label={tx.type === 'TRANSFER' ? 'Desde' : 'Cuenta'} value={account?.name ?? '—'} />
          {tx.type === 'TRANSFER' ? <Row label="Hacia" value={counter?.name ?? '—'} /> : null}
          {tx.type !== 'TRANSFER' ? (
            <View style={{ gap: theme.spacing(2) }}>
              <Row label="Categoría" value={category?.name ?? 'Sin categoría'} />
              {isAi ? (
                <View style={{ gap: theme.spacing(2) }}>
                  <Badge label="Sugerida por IA" tone="accent" icon="sparkles" />
                  <AppText variant="caption" tone="muted">
                    La categoría se asignó automáticamente. Confírmala o cámbiala.
                  </AppText>
                </View>
              ) : null}
              {changing ? (
                <FormField label="Nueva categoría">
                  <Select
                    title="Categoría"
                    value={tx.categoryId}
                    clearLabel="Sin categoría"
                    options={kindCategories.map((c) => ({
                      value: c.id,
                      label: c.name,
                      icon: (c.icon as IconName | null) ?? undefined,
                      color: c.color ?? undefined,
                    }))}
                    onChange={async (categoryId) => {
                      await setTransactionCategory(tx.id, categoryId);
                      setChanging(false);
                    }}
                  />
                </FormField>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) }}>
                  {isAi ? (
                    <Button label="Confirmar" icon="checkmark" compact onPress={() => setTransactionCategory(tx.id, tx.categoryId)} />
                  ) : null}
                  <Button label="Cambiar categoría" icon="pricetag-outline" variant="secondary" compact onPress={() => setChanging(true)} />
                </View>
              )}
            </View>
          ) : null}
          {tx.description ? <Row label="Descripción" value={tx.description} /> : null}
          {group ? (
            <Row label="Grupo de reembolso" value={group.name} onPress={() => router.push(`/finance/reimbursements/${group.id}`)} />
          ) : null}
          {tx.subscriptionId ? <Row label="Origen" value={`Suscripción · periodo ${tx.subscriptionPeriod}`} /> : null}
          {tx.cdtId ? <Row label="Origen" value="Movimiento de CDT" /> : null}
        </View>
      </GlassCard>

      <Button label="Eliminar movimiento" icon="trash-outline" variant="danger" onPress={onDelete} />
    </Screen>
  );
}

function Row({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  return (
    <View style={{ gap: 2 }}>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
      <AppText
        variant="bodyStrong"
        tone={onPress ? 'accent' : 'default'}
        onPress={onPress}
        accessibilityRole={onPress ? 'link' : undefined}>
        {value}
      </AppText>
    </View>
  );
}
