import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Pressable, View } from 'react-native';

import {
  AmountInput,
  Button,
  DateInput,
  FormField,
  GlassCard,
  Icon,
  SegmentedControl,
  Select,
  TextField,
  type IconName,
} from '@/components/ui';
import { formatDateLocal, isoDate, todayLocal } from '@/lib/dates';
import { toInputString } from '@/lib/money';
import { useTheme } from '@/theme';

import { ValidationError } from '../../data/FinanceRepository';
import { subscriptionFormSchema, type SubscriptionFormOutput, type SubscriptionFormValues } from '../../domain/schemas/subscription';
import type { BillingCycle, Subscription, SubscriptionInput } from '../../domain/types';
import { useAccountOptions } from '../../hooks/useAccounts';
import { useCategories } from '../../hooks/useTransactions';

const iconChoices: IconName[] = [
  'tv-outline',
  'musical-notes-outline',
  'barbell-outline',
  'cloud-outline',
  'globe-outline',
  'game-controller-outline',
  'newspaper-outline',
  'phone-portrait-outline',
];
const monthOptions = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: formatDateLocal(isoDate(2026, i + 1, 1), 'MMMM'),
}));

type Props = { initial?: Subscription; onSubmit: (input: SubscriptionInput) => Promise<unknown>; submitLabel: string };

export function SubscriptionForm({ initial, onSubmit, submitLabel }: Props) {
  const theme = useTheme();
  const accounts = useAccountOptions((a) => a.type !== 'INVESTMENT');
  const categories = useCategories('EXPENSE');
  const defaultCategory = categories.find((c) => c.name === 'Suscripciones')?.id ?? null;
  const { control, handleSubmit, setError, formState } = useForm<SubscriptionFormValues, unknown, SubscriptionFormOutput>({
    resolver: zodResolver(subscriptionFormSchema),
    defaultValues: {
      name: initial?.name ?? '',
      icon: initial?.icon ?? iconChoices[0]!,
      amount: initial ? toInputString(initial.amount) : '',
      billingCycle: initial?.billingCycle ?? 'MONTHLY',
      billingDay: String(initial?.billingDay ?? new Date().getDate()),
      billingMonth: initial?.billingMonth ? String(initial.billingMonth) : '',
      startDate: initial?.startDate ?? todayLocal(),
      accountId: initial?.accountId ?? accounts[0]?.account.id ?? null,
      categoryId: initial ? initial.categoryId : defaultCategory,
    },
  });
  const cycle = useWatch({ control, name: 'billingCycle' });

  const submit = handleSubmit(async (v) => {
    try {
      await onSubmit({ ...v, accountId: v.accountId, status: initial?.status ?? 'ACTIVE' });
    } catch (error) {
      if (error instanceof ValidationError) setError((error.field as keyof SubscriptionFormValues) ?? 'name', { message: error.message });
      else throw error;
    }
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
                  placeholder="Netflix"
                  maxLength={100}
                  accessibilityLabel="Nombre"
                />
              </FormField>
            )}
          />
          <Controller
            control={control}
            name="icon"
            render={({ field }) => (
              <FormField label="Ícono">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) }}>
                  {iconChoices.map((icon) => {
                    const selected = field.value === icon;
                    return (
                      <Pressable
                        key={icon}
                        onPress={() => field.onChange(icon)}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`Ícono ${icon}`}
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 1,
                          borderColor: selected ? theme.colors.accent : theme.colors.border,
                          backgroundColor: selected ? theme.colors.accentSoft : theme.colors.surface,
                        }}>
                        <Icon name={icon} size={20} color={selected ? theme.colors.accent : theme.colors.textMuted} />
                      </Pressable>
                    );
                  })}
                </View>
              </FormField>
            )}
          />
          <Controller
            control={control}
            name="amount"
            render={({ field, fieldState }) => (
              <FormField label="Monto" error={fieldState.error?.message}>
                <AmountInput
                  value={field.value}
                  onChangeText={field.onChange}
                  hasError={!!fieldState.error}
                  large={false}
                  accessibilityLabel="Monto"
                />
              </FormField>
            )}
          />
        </View>
      </GlassCard>

      <GlassCard>
        <View style={{ gap: theme.spacing(4) }}>
          <Controller
            control={control}
            name="billingCycle"
            render={({ field }) => (
              <SegmentedControl<BillingCycle>
                options={[
                  { value: 'MONTHLY', label: 'Mensual' },
                  { value: 'YEARLY', label: 'Anual' },
                ]}
                value={field.value}
                onChange={field.onChange}
                accessibilityLabel="Periodicidad"
              />
            )}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(3) }}>
            <View style={{ flexGrow: 1, flexBasis: 120 }}>
              <Controller
                control={control}
                name="billingDay"
                render={({ field, fieldState }) => (
                  <FormField label="Día de cobro" error={fieldState.error?.message}>
                    <TextField
                      value={field.value}
                      onChangeText={field.onChange}
                      hasError={!!fieldState.error}
                      keyboardType="number-pad"
                      inputMode="numeric"
                      maxLength={2}
                      accessibilityLabel="Día de cobro"
                    />
                  </FormField>
                )}
              />
            </View>
            {cycle === 'YEARLY' ? (
              <View style={{ flexGrow: 1, flexBasis: 160 }}>
                <Controller
                  control={control}
                  name="billingMonth"
                  render={({ field, fieldState }) => (
                    <FormField label="Mes de cobro" error={fieldState.error?.message}>
                      <Select
                        title="Mes de cobro"
                        value={field.value || null}
                        options={monthOptions}
                        hasError={!!fieldState.error}
                        onChange={(v) => field.onChange(v ?? '')}
                      />
                    </FormField>
                  )}
                />
              </View>
            ) : null}
          </View>
          <Controller
            control={control}
            name="startDate"
            render={({ field, fieldState }) => (
              <FormField label="Primer cobro desde" error={fieldState.error?.message}>
                <DateInput value={field.value} onChange={field.onChange} accessibilityLabel="Primer cobro desde" />
              </FormField>
            )}
          />
        </View>
      </GlassCard>

      <GlassCard>
        <View style={{ gap: theme.spacing(4) }}>
          <Controller
            control={control}
            name="accountId"
            render={({ field, fieldState }) => (
              <FormField label="Cuenta o tarjeta de cobro" error={fieldState.error?.message}>
                <Select
                  title="Cuenta de cobro"
                  value={field.value}
                  options={accounts.map((a) => ({ value: a.account.id, label: a.label }))}
                  hasError={!!fieldState.error}
                  onChange={field.onChange}
                />
              </FormField>
            )}
          />
          <Controller
            control={control}
            name="categoryId"
            render={({ field }) => (
              <FormField label="Categoría">
                <Select
                  title="Categoría"
                  value={field.value}
                  clearLabel="Sin categoría"
                  options={categories.map((c) => ({
                    value: c.id,
                    label: c.name,
                    icon: (c.icon as IconName | null) ?? undefined,
                    color: c.color ?? undefined,
                  }))}
                  onChange={field.onChange}
                />
              </FormField>
            )}
          />
        </View>
      </GlassCard>

      <Button label={submitLabel} icon="checkmark" onPress={submit} disabled={formState.isSubmitting} />
    </View>
  );
}
