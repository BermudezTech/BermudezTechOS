import { goBack, Screen } from '@/components/ui';
import { AssetForm } from '@/modules/finance/components/netWorth/AssetForm';
import { createAsset } from '@/modules/finance/hooks/useNetWorth';

export default function NewAssetScreen() {
  return (
    <Screen title="Nuevo bien" back fallback="/finance/net-worth" modal>
      <AssetForm
        submitLabel="Agregar"
        onSubmit={async (input) => {
          await createAsset(input);
          goBack('/finance/net-worth');
        }}
      />
    </Screen>
  );
}
