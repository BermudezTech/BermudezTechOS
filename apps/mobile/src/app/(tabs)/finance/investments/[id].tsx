import { useLocalSearchParams } from 'expo-router';

import { NotFound, Screen } from '@/components/ui';
import { CdtDetailPanel } from '@/modules/finance/components/investments/CdtDetailPanel';
import { useAccountMap } from '@/modules/finance/hooks/useAccounts';
import { useCdt } from '@/modules/finance/hooks/useCdts';

export default function CdtDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const values = useCdt(id);
  const accounts = useAccountMap();
  return (
    <Screen
      title={values ? `CDT ${values.cdt.issuer}` : 'CDT'}
      subtitle={values?.cdt.certificateNumber ?? undefined}
      back
      fallback="/finance/investments">
      {values ? <CdtDetailPanel values={values} accounts={accounts} /> : <NotFound />}
    </Screen>
  );
}
