import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';

import { AppText, Button, FormField, GlassCard, SegmentedControl, TextField } from '@/components/ui';
import { useTheme } from '@/theme';

import { reimbursementGroupFormSchema, type ReimbursementGroupFormValues } from '../../domain/schemas/reimbursementGroup';
import type { ReimbursementGroupInput, ReimbursementKind } from '../../domain/types';

type Output = Omit<ReimbursementGroupInput, 'status'>;

export function ReimbursementGroupForm({ onSubmit }: { onSubmit: (input: ReimbursementGroupInput) => Promise<unknown> }) {
  const theme = useTheme();
  const { control, handleSubmit, formState } = useForm<ReimbursementGroupFormValues, unknown, Output>({
    resolver: zodResolver(reimbursementGroupFormSchema),
    defaultValues: { name: '', payer: '', kind: 'REIMBURSEMENT', notes: '' },
  });
  const kind = useWatch({ control, name: 'kind' });

  return (
    <View style={{ gap: theme.spacing(4) }}>
      <Controller
        control={control}
        name="kind"
        render={({ field }) => (
          <SegmentedControl<ReimbursementKind>
            options={[
              { value: 'REIMBURSEMENT', label: 'Reembolso' },
              { value: 'ADVANCE', label: 'Adelanto' },
            ]}
            value={field.value}
            onChange={field.onChange}
            accessibilityLabel="Tipo de grupo"
          />
        )}
      />
      <AppText tone="muted">
        {kind === 'REIMBURSEMENT'
          ? 'Pagas con tu dinero y luego te devuelven (p. ej. viáticos de un viaje).'
          : 'Te consignan un adelanto y gastas de ahí; el sobrante se devuelve o el faltante te lo reembolsan.'}
      </AppText>
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
                  placeholder="Viaje Medellín – marzo"
                  maxLength={100}
                  accessibilityLabel="Nombre"
                />
              </FormField>
            )}
          />
          <Controller
            control={control}
            name="payer"
            render={({ field, fieldState }) => (
              <FormField label="Quién paga o reembolsa (opcional)" error={fieldState.error?.message}>
                <TextField
                  value={field.value}
                  onChangeText={field.onChange}
                  placeholder="Empresa o cliente"
                  maxLength={100}
                  accessibilityLabel="Pagador"
                />
              </FormField>
            )}
          />
          <Controller
            control={control}
            name="notes"
            render={({ field, fieldState }) => (
              <FormField label="Notas (opcional)" error={fieldState.error?.message}>
                <TextField value={field.value} onChangeText={field.onChange} multiline accessibilityLabel="Notas" />
              </FormField>
            )}
          />
        </View>
      </GlassCard>
      <Button
        label="Crear grupo"
        icon="checkmark"
        onPress={handleSubmit((v) => onSubmit({ ...v, status: 'OPEN' }))}
        disabled={formState.isSubmitting}
      />
    </View>
  );
}
