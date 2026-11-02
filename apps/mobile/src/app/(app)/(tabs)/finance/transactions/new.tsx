import { router, useLocalSearchParams } from 'expo-router';

import { NewTransactionScreen } from '@/modules/finance/components/transactions/NewTransactionScreen';
import type { TransactionType } from '@/modules/finance/domain/types';

export default function NewTransactionRoute() {
  const params = useLocalSearchParams<{ type?: TransactionType; accountId?: string; groupId?: string; recurringIncomeId?: string }>();
  return (
    <NewTransactionScreen
      defaults={{
        type: params.type,
        accountId: params.accountId,
        reimbursementGroupId: params.groupId,
        recurringIncomeId: params.recurringIncomeId,
      }}
      fallback="/finance/transactions"
      onCreateAccount={() => router.replace('/finance/accounts/new')}
    />
  );
}
