import { useLocalSearchParams } from 'expo-router';

import { goBack, NotFound, Screen } from '@/components/ui';
import { CdtForm } from '@/modules/finance/components/investments/CdtForm';
import { updateCdt, useCdt } from '@/modules/finance/hooks/useCdts';

export default function EditCdtScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const values = useCdt(id);
  const back = `/finance/investments/${id}`;
  return (
    <Screen title="Editar CDT" back fallback={back} modal>
      {values && values.cdt.status === 'ACTIVE' ? (
        <CdtForm
          initial={values.cdt}
          onSubmit={async (input) => {
            await updateCdt(values.cdt.id, input);
            goBack(back);
          }}
        />
      ) : (
        <NotFound />
      )}
    </Screen>
  );
}
