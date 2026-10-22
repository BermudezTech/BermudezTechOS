import { useLocalSearchParams } from 'expo-router';

import { goBack, NotFound, Screen } from '@/components/ui';
import { TransactionForm } from '@/modules/finance/components/transactions/TransactionForm';
import { useAccountOptions } from '@/modules/finance/hooks/useAccounts';
import { useGroupField } from '@/modules/finance/hooks/useGroupField';
import { updateTransaction, useCategories, useTransaction } from '@/modules/finance/hooks/useTransactions';

export default function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tx = useTransaction(id);
  const accounts = useAccountOptions();
  const categories = useCategories();
  const renderGroupField = useGroupField();
  return (
    <Screen title="Editar movimiento" back fallback="/finance/transactions" modal>
      {tx ? (
        <TransactionForm
          initial={tx}
          accounts={accounts}
          categories={categories}
          renderGroupField={renderGroupField}
          submitLabel="Guardar cambios"
          onSubmit={async (input) => {
            await updateTransaction(tx.id, input);
            goBack(`/finance/transactions/${tx.id}`);
          }}
        />
      ) : (
        <NotFound />
      )}
    </Screen>
  );
}
