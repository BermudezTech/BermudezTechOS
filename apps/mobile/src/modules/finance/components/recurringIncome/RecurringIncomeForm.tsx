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
import {
  recurringIncomeFormSchema,
  type RecurringIncomeFormOutput,
  type RecurringIncomeFormValues,
} from '../../domain/schemas/recurringIncome';
import type { RecurringIncome, RecurringIncomeCycle, RecurringIncomeInput } from '../../domain/types';
import { useAccountOptions } from '../../hooks/useAccounts';
import { useCategories } from '../../hooks/useTransactions';

const iconChoices: IconName[] = [
  'briefcase-outline',
  'cash-outline',
  'home-outline',
  'laptop-outline',
  'school-outline',
  'gift-outline',
  'people-outline',
  'trending-up-outline',
];
const monthOptions = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: formatDateLocal(isoDate(2026, i + 1, 1), 'MMMM'),
}));

type Props = { initial?: RecurringIncome; onSubmit: (input: RecurringIncomeInput) => Promise<unknown>; submitLabel: string };

/** Plantilla de ingreso recurrente (contracts/ui.md); mismo esquema visual que `SubscriptionForm`. */
export function RecurringIncomeForm({ initial, onSubmit, submitLabel }: Props) {
  const theme = useTheme();
  const accounts = useAccountOptions((a) => a.type !== 'INVESTMENT' && a.type !== 'CREDIT_CARD');
  const categories = useCategories('INCOME');
  const defaultCategory = categories.find((c) => c.name === 'Salario')?.id ?? null;
  const { control, handleSubmit, setError, formState } = useForm<RecurringIncomeFormValues, unknown, RecurringIncomeFormOutput>({
    resolver: zodResolver(recurringIncomeFormSchema),
    defaultValues: {
      name: initial?.name ?? '',
      icon: initial?.icon ?? iconChoices[0]!,
      expectedAmount: initial ? toInputString(initial.expectedAmount) : '',
      cycle: initial?.cycle ?? 'MONTHLY',
      expectedDay: String(initial?.expectedDay ?? new Date().getDate()),
      expectedMonth: initial?.expectedMonth ? String(initial.expectedMonth) : '',
      startDate: initial?.startDate ?? todayLocal(),
      accountId: initial?.accountId ?? accounts[0]?.account.id ?? null,
      categoryId: initial ? initial.categoryId : defaultCategory,
    },
  });
  const cycle = useWatch({ control, name: 'cycle' });

  const submit = handleSubmit(async (v) => {
    try {
      await onSubmit({ ...v, accountId: v.accountId, status: initial?.status ?? 'ACTIVE' });
    } catch (error) {
      if (error instanceof ValidationError)
        setError((error.field as keyof RecurringIncomeFormValues) ?? 'name', { message: error.message });
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
                  placeholder="Salario"
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
            name="expectedAmount"
            render={({ field, fieldState }) => (
              <FormField label="Valor esperado" error={fieldState.error?.message} hint="Lo podrás cambiar cada vez que lo registres.">
                <AmountInput
                  value={field.value}
                  onChangeText={field.onChange}
                  hasError={!!fieldState.error}
                  large={false}
                  accessibilityLabel="Valor esperado"
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
            name="cycle"
            render={({ field }) => (
              <SegmentedControl<RecurringIncomeCycle>
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
                name="expectedDay"
                render={({ field, fieldState }) => (
                  <FormField label="Día esperado" error={fieldState.error?.message}>
                    <TextField
                      value={field.value}
                      onChangeText={field.onChange}
                      hasError={!!fieldState.error}
                      keyboardType="number-pad"
                      inputMode="numeric"
                      maxLength={2}
                      accessibilityLabel="Día esperado"
                    />
                  </FormField>
                )}
              />
            </View>
            {cycle === 'YEARLY' ? (
              <View style={{ flexGrow: 1, flexBasis: 160 }}>
                <Controller
                  control={control}
                  name="expectedMonth"
                  render={({ field, fieldState }) => (
                    <FormField label="Mes esperado" error={fieldState.error?.message}>
                      <Select
                        title="Mes esperado"
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
              <FormField label="Desde" error={fieldState.error?.message}>
                <DateInput value={field.value} onChange={field.onChange} accessibilityLabel="Desde" />
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
              <FormField label="Cuenta de destino" error={fieldState.error?.message}>
                <Select
                  title="Cuenta de destino"
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
