import { useLocalSearchParams } from 'expo-router';

import { goBack, Screen } from '@/components/ui';
import { AccountForm } from '@/modules/finance/components/accounts/AccountForm';
import { createAccount } from '@/modules/finance/hooks/useAccounts';

export default function NewAccountScreen() {
  const { parentId } = useLocalSearchParams<{ parentId?: string }>();
  return (
    <Screen title={parentId ? 'Nueva cajita' : 'Nueva cuenta'} back fallback="/finance/accounts" modal>
      <AccountForm
        defaultParentId={parentId ?? null}
        submitLabel="Crear"
        onSubmit={async (input) => {
          await createAccount(input);
          goBack('/finance/accounts');
        }}
      />
    </Screen>
  );
}
