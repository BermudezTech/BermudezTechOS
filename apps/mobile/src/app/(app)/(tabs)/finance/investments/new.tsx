import { goBack, Screen } from '@/components/ui';
import { CdtForm } from '@/modules/finance/components/investments/CdtForm';
import { createCdt } from '@/modules/finance/hooks/useCdts';

export default function NewCdtScreen() {
  return (
    <Screen title="Nuevo CDT" back fallback="/finance/investments" modal>
      <CdtForm
        onSubmit={async (input) => {
          await createCdt(input);
          goBack('/finance/investments');
        }}
      />
    </Screen>
  );
}
