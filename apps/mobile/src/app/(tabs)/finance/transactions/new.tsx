import { router, useLocalSearchParams } from 'expo-router';

import { EmptyState, goBack, Screen } from '@/components/ui';
import { TransactionForm } from '@/modules/finance/components/transactions/TransactionForm';
import type { TransactionType } from '@/modules/finance/domain/types';
import { useAccountOptions } from '@/modules/finance/hooks/useAccounts';
import { createTransaction, useCategories } from '@/modules/finance/hooks/useTransactions';
import { useGroupField } from '@/modules/finance/hooks/useGroupField';

export default function NewTransactionScreen() {
  const params = useLocalSearchParams<{ type?: TransactionType; accountId?: string; groupId?: string }>();
  const accounts = useAccountOptions();
  const categories = useCategories();
  const renderGroupField = useGroupField();
  return (
    <Screen title="Nuevo movimiento" back fallback="/finance/transactions" modal>
      {accounts.length === 0 ? (
        <EmptyState
          icon="wallet-outline"
          title="Primero crea una cuenta"
          message="Los movimientos se registran en una cuenta, tarjeta o efectivo."
          actionLabel="Nueva cuenta"
          onAction={() => router.replace('/finance/accounts/new')}
        />
      ) : (
        <TransactionForm
          accounts={accounts}
          categories={categories}
          defaults={{ type: params.type, accountId: params.accountId, reimbursementGroupId: params.groupId }}
          renderGroupField={renderGroupField}
          onSubmit={async (input) => {
            await createTransaction(input);
            goBack('/finance/transactions');
          }}
        />
      )}
    </Screen>
  );
}
