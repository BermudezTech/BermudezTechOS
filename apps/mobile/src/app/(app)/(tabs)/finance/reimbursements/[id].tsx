import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { Amount, AppText, Badge, Button, confirm, EmptyState, GlassCard, notify, NotFound, Screen, SectionHeader } from '@/components/ui';
import { abs } from '@/lib/money';
import { groupStatusMeta } from '@/modules/finance/components/reimbursements/GroupListItem';
import { TransactionListItem } from '@/modules/finance/components/transactions/TransactionListItem';
import { ValidationError } from '@/modules/finance/data/FinanceRepository';
import type { GroupStatus } from '@/modules/finance/domain/types';
import { useAccountMap } from '@/modules/finance/hooks/useAccounts';
import { useCategoryMap } from '@/modules/finance/hooks/useFinanceData';
import { setReimbursementGroupStatus, useReimbursementGroup } from '@/modules/finance/hooks/useReimbursements';
import { useTheme } from '@/theme';

export default function GroupDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useReimbursementGroup(id);
  const accounts = useAccountMap();
  const categories = useCategoryMap();

  if (!detail) {
    return (
      <Screen title="Grupo" back fallback="/finance/reimbursements">
        <NotFound />
      </Screen>
    );
  }
  const { group, balance, label } = detail;
  const settled = group.status === 'SETTLED';

  const changeStatus = async (status: GroupStatus) => {
    if (
      status === 'SETTLED' &&
      !(await confirm({ title: 'Marcar como saldado', message: 'El grupo pasará a la sección de cerrados.', confirmLabel: 'Saldar' }))
    )
      return;
    try {
      await setReimbursementGroupStatus(group.id, status);
    } catch (error) {
      notify('No se pudo cambiar el estado', error instanceof ValidationError ? error.message : undefined);
    }
  };

  return (
    <Screen
      title={group.name}
      subtitle={[group.kind === 'ADVANCE' ? 'Adelanto' : 'Reembolso', group.payer].filter(Boolean).join(' · ')}
      back
      fallback="/finance/reimbursements">
      <GlassCard>
        <View style={{ gap: theme.spacing(2) }}>
          <Badge label={groupStatusMeta[group.status].label} tone={groupStatusMeta[group.status].tone} />
          <AppText variant="caption" tone="muted">
            {label}
          </AppText>
          <Amount value={abs(balance)} size="large" variant={balance < 0 ? 'debt' : balance > 0 ? 'transfer' : 'default'} />
          <AppText variant="caption" tone="muted">
            {balance < 0
              ? 'Pendiente por reembolsar.'
              : balance > 0
                ? 'Dinero de terceros por gastar o devolver.'
                : 'Ingresos y gastos del grupo están equilibrados.'}
          </AppText>
          {group.notes ? <AppText tone="muted">{group.notes}</AppText> : null}
        </View>
      </GlassCard>

      {!settled ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) }}>
          <Button
            label="Registrar gasto"
            icon="arrow-up"
            compact
            onPress={() => router.push(`/finance/transactions/new?groupId=${group.id}&type=EXPENSE`)}
          />
          <Button
            label="Registrar ingreso"
            icon="arrow-down"
            variant="secondary"
            compact
            onPress={() => router.push(`/finance/transactions/new?groupId=${group.id}&type=INCOME`)}
          />
          {group.status === 'OPEN' ? (
            <Button label="Marcar como enviado" icon="send-outline" variant="secondary" compact onPress={() => changeStatus('SUBMITTED')} />
          ) : null}
          <Button
            label="Marcar como saldado"
            icon="checkmark-done-outline"
            variant="secondary"
            compact
            disabled={balance !== 0}
            onPress={() => changeStatus('SETTLED')}
          />
        </View>
      ) : null}
      {!settled && balance !== 0 ? (
        <AppText variant="caption" tone="muted">
          Podrás marcarlo como saldado cuando el saldo llegue a cero.
        </AppText>
      ) : null}

      <SectionHeader title="Movimientos del grupo" />
      {detail.transactions.length === 0 ? (
        <EmptyState icon="receipt-outline" title="Sin movimientos" message="Registra los gastos, adelantos o reembolsos de este grupo." />
      ) : (
        <GlassCard padded={false} style={{ padding: theme.spacing(2) }}>
          {detail.transactions.map((tx) => (
            <TransactionListItem
              key={tx.id}
              tx={tx}
              category={tx.categoryId ? categories.get(tx.categoryId) : undefined}
              accounts={accounts}
              showDate
            />
          ))}
        </GlassCard>
      )}
    </Screen>
  );
}
