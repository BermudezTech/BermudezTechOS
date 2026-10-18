import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { AppText, Badge, Button, confirm, goBack, NotFound, Screen } from '@/components/ui';
import { AssetForm } from '@/modules/finance/components/netWorth/AssetForm';
import { deleteAsset, updateAsset, useAsset } from '@/modules/finance/hooks/useNetWorth';
import { useTheme } from '@/theme';

export default function EditAssetScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const asset = useAsset(id);
  return (
    <Screen title="Editar bien" back fallback="/finance/net-worth" modal>
      {asset ? (
        <View style={{ gap: theme.spacing(4) }}>
          {asset.isValueExpired ? (
            <View style={{ gap: theme.spacing(1) }}>
              <Badge label="El valor estimado venció" tone="warning" icon="alert-circle-outline" />
              <AppText tone="muted">Actualiza el valor y la fecha de validez para que tu patrimonio sea preciso.</AppText>
            </View>
          ) : null}
          <AssetForm
            initial={asset}
            submitLabel="Guardar cambios"
            onSubmit={async (input) => {
              await updateAsset(asset.id, input);
              goBack('/finance/net-worth');
            }}
          />
          <Button
            label="Eliminar bien"
            icon="trash-outline"
            variant="danger"
            onPress={async () => {
              if (await confirm({ title: `¿Eliminar "${asset.name}"?`, confirmLabel: 'Eliminar', destructive: true })) {
                await deleteAsset(asset.id);
                goBack('/finance/net-worth');
              }
            }}
          />
        </View>
      ) : (
        <NotFound />
      )}
    </Screen>
  );
}
