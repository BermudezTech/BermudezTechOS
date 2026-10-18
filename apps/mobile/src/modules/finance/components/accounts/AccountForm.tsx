import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Pressable, View } from 'react-native';

import { AmountInput, Button, FormField, GlassCard, Icon, Select, SwitchField, TextField, type SelectOption } from '@/components/ui';
import { toInputString } from '@/lib/money';
import { useTheme } from '@/theme';

import { ValidationError } from '../../data/FinanceRepository';
import { accountFormSchema, toAccountInput, type AccountFormValues } from '../../domain/schemas/account';
import type { Account, AccountInput, AccountType } from '../../domain/types';
import { useAccountOptions } from '../../hooks/useAccounts';
import { accountIconChoices, accountTypeMeta } from './accountMeta';

type Props = {
  initial?: Account;
  defaultParentId?: string | null;
  onSubmit: (input: AccountInput) => Promise<unknown>;
  submitLabel: string;
};

const editableTypes: AccountType[] = ['SAVINGS', 'CHECKING', 'CASH', 'CREDIT_CARD', 'POCKET'];

export function AccountForm({ initial, defaultParentId, onSubmit, submitLabel }: Props) {
  const theme = useTheme();
  const parents = useAccountOptions((a) => !a.parentAccountId && ['CHECKING', 'SAVINGS', 'CASH'].includes(a.type) && a.id !== initial?.id);

  const { control, handleSubmit, setError, formState } = useForm<AccountFormValues, unknown, ReturnType<typeof accountFormSchema.parse>>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      type: initial?.type ?? (defaultParentId ? 'POCKET' : 'SAVINGS'),
      name: initial?.name ?? '',
      parentAccountId: initial?.parentAccountId ?? defaultParentId ?? null,
      openingBalance: initial ? toInputString(initial.openingBalance) : '0',
      creditLimit: initial?.creditLimit ? toInputString(initial.creditLimit) : '',
      statementDay: initial?.statementDay ? String(initial.statementDay) : '',
      paymentDueDay: initial?.paymentDueDay ? String(initial.paymentDueDay) : '',
      icon: initial?.icon ?? null,
      color: initial?.color ?? theme.colors.categoryPalette[0]!,
      isExcludedFromNetWorth: initial?.isExcludedFromNetWorth ?? false,
    },
  });
  const type = useWatch({ control, name: 'type' });
  const color = useWatch({ control, name: 'color' });
  const isCard = type === 'CREDIT_CARD';

  const typeOptions: SelectOption<AccountType>[] = (
    initial?.type === 'INVESTMENT' ? [...editableTypes, 'INVESTMENT' as const] : editableTypes
  ).map((t) => ({
    value: t,
    label: accountTypeMeta[t].label,
    icon: accountTypeMeta[t].icon,
  }));

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(toAccountInput(values, initial));
    } catch (error) {
      if (error instanceof ValidationError) {
        setError((error.field as keyof AccountFormValues) ?? 'name', { message: error.message });
      } else throw error;
    }
  });

  return (
    <View style={{ gap: theme.spacing(4) }}>
      <GlassCard>
        <View style={{ gap: theme.spacing(4) }}>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <FormField label="Tipo de cuenta">
                <Select title="Tipo de cuenta" value={field.value} options={typeOptions} onChange={(v) => v && field.onChange(v)} />
              </FormField>
            )}
          />
          <Controller
            control={control}
            name="name"
            render={({ field, fieldState }) => (
              <FormField label="Nombre" error={fieldState.error?.message}>
                <TextField
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  hasError={!!fieldState.error}
                  placeholder={isCard ? 'Visa Bancolombia' : type === 'POCKET' ? 'Cajita Vacaciones' : 'Bancolombia Ahorros'}
                  maxLength={100}
                  accessibilityLabel="Nombre"
                />
              </FormField>
            )}
          />
          {type === 'POCKET' ? (
            <Controller
              control={control}
              name="parentAccountId"
              render={({ field, fieldState }) => (
                <FormField label="Cuenta principal" error={fieldState.error?.message}>
                  <Select
                    title="Cuenta principal"
                    value={field.value}
                    hasError={!!fieldState.error}
                    options={parents.map((p) => ({ value: p.account.id, label: p.label, icon: accountTypeMeta[p.account.type].icon }))}
                    onChange={field.onChange}
                  />
                </FormField>
              )}
            />
          ) : null}
          <Controller
            control={control}
            name="openingBalance"
            render={({ field, fieldState }) => (
              <FormField
                label={isCard ? 'Deuda inicial' : 'Saldo inicial'}
                error={fieldState.error?.message}
                hint={isCard ? 'Lo que debías al empezar a usar la app.' : 'El saldo que tenía la cuenta al crearla en la app.'}>
                <AmountInput
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  hasError={!!fieldState.error}
                  large={false}
                  accessibilityLabel="Saldo inicial"
                />
              </FormField>
            )}
          />
        </View>
      </GlassCard>

      {isCard ? (
        <GlassCard>
          <View style={{ gap: theme.spacing(4) }}>
            <Controller
              control={control}
              name="creditLimit"
              render={({ field, fieldState }) => (
                <FormField label="Cupo" error={fieldState.error?.message}>
                  <AmountInput
                    value={field.value}
                    onChangeText={field.onChange}
                    hasError={!!fieldState.error}
                    large={false}
                    accessibilityLabel="Cupo"
                  />
                </FormField>
              )}
            />
            <View style={{ flexDirection: 'row', gap: theme.spacing(3) }}>
              {(['statementDay', 'paymentDueDay'] as const).map((name) => (
                <View key={name} style={{ flex: 1 }}>
                  <Controller
                    control={control}
                    name={name}
                    render={({ field, fieldState }) => (
                      <FormField label={name === 'statementDay' ? 'Día de corte' : 'Día de pago'} error={fieldState.error?.message}>
                        <TextField
                          value={field.value}
                          onChangeText={field.onChange}
                          hasError={!!fieldState.error}
                          keyboardType="number-pad"
                          inputMode="numeric"
                          placeholder="1–31"
                          maxLength={2}
                        />
                      </FormField>
                    )}
                  />
                </View>
              ))}
            </View>
          </View>
        </GlassCard>
      ) : null}

      <GlassCard>
        <View style={{ gap: theme.spacing(4) }}>
          <Controller
            control={control}
            name="icon"
            render={({ field }) => (
              <FormField label="Ícono">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) }}>
                  {accountIconChoices.map((icon) => {
                    const selected = (field.value ?? accountTypeMeta[type].icon) === icon;
                    return (
                      <Pressable
                        key={icon}
                        onPress={() => field.onChange(icon)}
                        accessibilityRole="button"
                        accessibilityLabel={`Ícono ${icon}`}
                        accessibilityState={{ selected }}
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: selected ? `${color ?? theme.colors.accent}33` : theme.colors.surface,
                          borderWidth: 1,
                          borderColor: selected ? (color ?? theme.colors.accent) : theme.colors.border,
                        }}>
                        <Icon name={icon} size={20} color={selected ? (color ?? theme.colors.accent) : theme.colors.textMuted} />
                      </Pressable>
                    );
                  })}
                </View>
              </FormField>
            )}
          />
          <Controller
            control={control}
            name="color"
            render={({ field }) => (
              <FormField label="Color">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) }}>
                  {theme.colors.categoryPalette.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => field.onChange(c)}
                      accessibilityRole="button"
                      accessibilityLabel={`Color ${c}`}
                      accessibilityState={{ selected: field.value === c }}
                      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                      <View
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 15,
                          backgroundColor: c,
                          borderWidth: field.value === c ? 3 : 0,
                          borderColor: theme.colors.text,
                        }}
                      />
                    </Pressable>
                  ))}
                </View>
              </FormField>
            )}
          />
          <Controller
            control={control}
            name="isExcludedFromNetWorth"
            render={({ field }) => (
              <SwitchField
                label="Excluir del patrimonio"
                description="Para cuentas con dinero que no es tuyo o no es de libre disposición."
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </View>
      </GlassCard>

      <Button label={submitLabel} icon="checkmark" onPress={submit} disabled={formState.isSubmitting} />
    </View>
  );
}
