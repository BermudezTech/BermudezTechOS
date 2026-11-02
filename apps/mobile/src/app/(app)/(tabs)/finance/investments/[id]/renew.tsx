import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { AppText, Button, goBack, NotFound, Screen } from '@/components/ui';
import { formatDateLocal } from '@/lib/dates';
import { CdtRenewalForm } from '@/modules/finance/components/investments/CdtRenewalForm';
import { renewCdt, useCdt } from '@/modules/finance/hooks/useCdts';
import { useTheme } from '@/theme';

export default function RenewCdtScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const values = useCdt(id);
  const back = `/finance/investments/${id}`;
  return (
    <Screen title={values ? `Renovar CDT ${values.cdt.issuer}` : 'Renovar CDT'} back fallback={back} modal>
      {!values ? (
        <NotFound />
      ) : !values.canRenew ? (
        <View style={{ gap: theme.spacing(3) }}>
          <AppText tone="muted">
            {values.cdt.status === 'ACTIVE'
              ? `Podrás renovar este CDT desde el ${formatDateLocal(values.cdt.maturesOn, "d 'de' MMMM 'de' yyyy")}.`
              : 'Este CDT ya fue renovado.'}
          </AppText>
          <Button label="Volver" variant="secondary" onPress={() => goBack(back)} />
        </View>
      ) : (
        <CdtRenewalForm
          values={values}
          onSubmit={async (input) => {
            const next = await renewCdt(values.cdt.id, input);
            router.replace(`/finance/investments/${next.id}`);
          }}
        />
      )}
    </Screen>
  );
}
