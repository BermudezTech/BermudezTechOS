import { useLocalSearchParams } from 'expo-router';

import { goBack, NotFound, Screen } from '@/components/ui';
import { AccountForm } from '@/modules/finance/components/accounts/AccountForm';
import { updateAccount, useAccount } from '@/modules/finance/hooks/useAccounts';

export default function EditAccountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useAccount(id);
  return (
    <Screen title="Editar cuenta" back fallback="/finance/accounts" modal>
      {detail ? (
        <AccountForm
          initial={detail.account}
          submitLabel="Guardar cambios"
          onSubmit={async (input) => {
            await updateAccount(detail.account.id, input);
            goBack(`/finance/accounts/${detail.account.id}`);
          }}
        />
      ) : (
        <NotFound />
      )}
    </Screen>
  );
}
