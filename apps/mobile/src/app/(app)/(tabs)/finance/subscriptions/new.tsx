import { goBack, Screen } from '@/components/ui';
import { SubscriptionForm } from '@/modules/finance/components/subscriptions/SubscriptionForm';
import { createSubscription } from '@/modules/finance/hooks/useSubscriptions';

export default function NewSubscriptionScreen() {
  return (
    <Screen title="Nueva suscripción" back fallback="/finance/subscriptions" modal>
      <SubscriptionForm
        submitLabel="Crear"
        onSubmit={async (input) => {
          await createSubscription(input);
          goBack('/finance/subscriptions');
        }}
      />
    </Screen>
  );
}
