import { router } from 'expo-router';

import { EmptyState, GlassCard, SectionHeader } from '@/components/ui';
import { useTheme } from '@/theme';

import { useAccountMap } from '../../hooks/useAccounts';
import { useCategoryMap } from '../../hooks/useFinanceData';
import { useRecentTransactions } from '../../hooks/useTransactions';
import { TransactionListItem } from '../transactions/TransactionListItem';

export function RecentTransactionsCard() {
  const theme = useTheme();
  const recent = useRecentTransactions(5);
  const accounts = useAccountMap();
  const categories = useCategoryMap();
  return (
    <GlassCard padded={false} style={{ padding: theme.spacing(2) }}>
      <SectionHeader title="Últimos movimientos" actionLabel="Ver todos" onAction={() => router.push('/finance/transactions')} />
      {recent.length === 0 ? (
        <EmptyState
          icon="receipt-outline"
          title="Sin movimientos"
          actionLabel="Registrar"
          onAction={() => router.push('/finance/transactions/new')}
        />
      ) : (
        recent.map((tx) => (
          <TransactionListItem
            key={tx.id}
            tx={tx}
            category={tx.categoryId ? categories.get(tx.categoryId) : undefined}
            accounts={accounts}
            showDate
          />
        ))
      )}
    </GlassCard>
  );
}
