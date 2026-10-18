import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

import { Amount, AppText, EmptyState, GlassCard, Screen } from '@/components/ui';
import { periodLabel } from '@/lib/dates';
import { sum } from '@/lib/money';
import { TransactionListItem } from '@/modules/finance/components/transactions/TransactionListItem';
import { useAccountMap } from '@/modules/finance/hooks/useAccounts';
import { useCategoryMap } from '@/modules/finance/hooks/useFinanceData';
import { usePeriodParams } from '@/modules/finance/hooks/usePeriodParams';
import { useCategorySpending } from '@/modules/finance/hooks/useSpending';
import { useTheme } from '@/theme';

export default function CategorySpendingScreen() {
  const theme = useTheme();
  const { categoryId: raw } = useLocalSearchParams<{ categoryId: string }>();
  const categoryId = raw === 'none' ? null : raw;
  const [period] = usePeriodParams();
  const transactions = useCategorySpending(categoryId, period);
  const categories = useCategoryMap();
  const accounts = useAccountMap();
  const category = categoryId ? categories.get(categoryId) : undefined;
  const total = useMemo(() => sum(transactions.map((t) => t.amount)), [transactions]);

  return (
    <Screen title={category?.name ?? 'Sin categoría'} subtitle={periodLabel(period)} back fallback="/finance/spending">
      <GlassCard>
        <AppText variant="caption" tone="muted">
          Total del periodo
        </AppText>
        <Amount value={total} size="large" />
      </GlassCard>
      {transactions.length === 0 ? (
        <EmptyState icon="receipt-outline" title="Sin movimientos" message="No hay gastos de esta categoría en el periodo." />
      ) : (
        <GlassCard padded={false} style={{ padding: theme.spacing(2) }}>
          {transactions.map((tx) => (
            <TransactionListItem key={tx.id} tx={tx} category={category} accounts={accounts} showDate />
          ))}
        </GlassCard>
      )}
    </Screen>
  );
}
