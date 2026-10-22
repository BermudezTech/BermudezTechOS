import { goBack, Screen } from '@/components/ui';
import { ReimbursementGroupForm } from '@/modules/finance/components/reimbursements/ReimbursementGroupForm';
import { createReimbursementGroup } from '@/modules/finance/hooks/useReimbursements';

export default function NewGroupScreen() {
  return (
    <Screen title="Nuevo grupo" back fallback="/finance/reimbursements" modal>
      <ReimbursementGroupForm
        onSubmit={async (input) => {
          await createReimbursementGroup(input);
          goBack('/finance/reimbursements');
        }}
      />
    </Screen>
  );
}
