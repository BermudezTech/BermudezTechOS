import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { AmountInput, Button, DateInput, FormField, GlassCard, TextField } from '@/components/ui';
import { addDays, todayLocal } from '@/lib/dates';
import { toInputString } from '@/lib/money';
import { useTheme } from '@/theme';

import { assetFormSchema, type AssetFormValues } from '../../domain/schemas/asset';
import type { Asset, AssetInput } from '../../domain/types';

type Props = { initial?: Asset; onSubmit: (input: AssetInput) => Promise<unknown>; submitLabel: string };

export function AssetForm({ initial, onSubmit, submitLabel }: Props) {
  const theme = useTheme();
  const { control, handleSubmit, formState } = useForm<AssetFormValues, unknown, AssetInput>({
    resolver: zodResolver(assetFormSchema),
    defaultValues: {
      name: initial?.name ?? '',
      value: initial ? toInputString(initial.value) : '',
      validUntil: initial?.validUntil ?? addDays(todayLocal(), 180),
    },
  });

  return (
    <View style={{ gap: theme.spacing(4) }}>
      <GlassCard>
        <View style={{ gap: theme.spacing(4) }}>
          <Controller
            control={control}
            name="name"
            render={({ field, fieldState }) => (
              <FormField label="Nombre" error={fieldState.error?.message}>
                <TextField
                  value={field.value}
                  onChangeText={field.onChange}
                  hasError={!!fieldState.error}
                  placeholder="Mazda 3 2020"
                  maxLength={100}
                  accessibilityLabel="Nombre"
                />
              </FormField>
            )}
          />
          <Controller
            control={control}
            name="value"
            render={({ field, fieldState }) => (
              <FormField label="Valor estimado" error={fieldState.error?.message}>
                <AmountInput
                  value={field.value}
                  onChangeText={field.onChange}
                  hasError={!!fieldState.error}
                  large={false}
                  accessibilityLabel="Valor estimado"
                />
              </FormField>
            )}
          />
          <Controller
            control={control}
            name="validUntil"
            render={({ field, fieldState }) => (
              <FormField
                label="Valor válido hasta"
                error={fieldState.error?.message}
                hint="Después de esta fecha la app te pedirá actualizar el valor.">
                <DateInput
                  value={field.value}
                  onChange={field.onChange}
                  hasError={!!fieldState.error}
                  accessibilityLabel="Valor válido hasta"
                />
              </FormField>
            )}
          />
        </View>
      </GlassCard>
      <Button label={submitLabel} icon="checkmark" onPress={handleSubmit((v) => onSubmit(v))} disabled={formState.isSubmitting} />
    </View>
  );
}
