import { useLocalSearchParams } from 'expo-router';

import { goBack, NotFound, Screen } from '@/components/ui';
import { SubscriptionForm } from '@/modules/finance/components/subscriptions/SubscriptionForm';
import { updateSubscription, useSubscription } from '@/modules/finance/hooks/useSubscriptions';

export default function EditSubscriptionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sub = useSubscription(id);
  return (
    <Screen title="Editar suscripción" back fallback="/finance/subscriptions" modal>
      {sub ? (
        <SubscriptionForm
          initial={sub}
          submitLabel="Guardar cambios"
          onSubmit={async (input) => {
            await updateSubscription(sub.id, input);
            goBack('/finance/subscriptions');
          }}
        />
      ) : (
        <NotFound />
      )}
    </Screen>
  );
}
