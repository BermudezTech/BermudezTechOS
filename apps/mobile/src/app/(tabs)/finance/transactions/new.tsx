import { router, useLocalSearchParams } from 'expo-router';

import { EmptyState, goBack, Screen } from '@/components/ui';
import { TransactionForm } from '@/modules/finance/components/transactions/TransactionForm';
import type { TransactionType } from '@/modules/finance/domain/types';
import { useAccountOptions } from '@/modules/finance/hooks/useAccounts';
import { createTransaction, useCategories } from '@/modules/finance/hooks/useTransactions';
import { useGroupField } from '@/modules/finance/hooks/useGroupField';
import { useSelectableRecurringIncomes } from '@/modules/finance/hooks/useRecurringIncomes';

export default function NewTransactionScreen() {
  const params = useLocalSearchParams<{ type?: TransactionType; accountId?: string; groupId?: string; recurringIncomeId?: string }>();
  const accounts = useAccountOptions();
  const categories = useCategories();
  const renderGroupField = useGroupField();
  const recurringIncomes = useSelectableRecurringIncomes();
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
          recurringIncomes={recurringIncomes}
          defaults={{
            type: params.type,
            accountId: params.accountId,
            reimbursementGroupId: params.groupId,
            recurringIncomeId: params.recurringIncomeId,
          }}
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
