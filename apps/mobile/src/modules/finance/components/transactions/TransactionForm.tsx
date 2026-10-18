import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Pressable, View } from 'react-native';

import {
  AmountInput,
  AppText,
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
import { localDayKey, todayLocal } from '@/lib/dates';
import { toInputString } from '@/lib/money';
import { useTheme } from '@/theme';

import { ValidationError } from '../../data/FinanceRepository';
import {
  toTransactionInput,
  transactionFormSchema,
  type TransactionFormOutput,
  type TransactionFormValues,
} from '../../domain/schemas/transaction';
import type { Account, Category, Transaction, TransactionInput, TransactionType } from '../../domain/types';
import { accountTypeMeta } from '../accounts/accountMeta';

export type TransactionFormDefaults = {
  type?: TransactionType;
  accountId?: string | null;
  reimbursementGroupId?: string | null;
};

type Props = {
  initial?: Transaction;
  defaults?: TransactionFormDefaults;
  accounts: { account: Account; label: string }[];
  categories: Category[];
  onSubmit: (input: TransactionInput) => Promise<unknown>;
  submitLabel?: string;
  /** Selector opcional de grupo de reembolso (lo añade la sección de reembolsos). */
  renderGroupField?: (props: { value: string | null; onChange: (id: string | null) => void }) => React.ReactNode;
};

const typeOptions: { value: TransactionType; label: string }[] = [
  { value: 'EXPENSE', label: 'Egreso' },
  { value: 'INCOME', label: 'Ingreso' },
  { value: 'TRANSFER', label: 'Transferir' },
];

export function TransactionForm({ initial, defaults, accounts, categories, onSubmit, submitLabel = 'Guardar', renderGroupField }: Props) {
  const theme = useTheme();
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const schema = useMemo(() => transactionFormSchema(categoryMap), [categoryMap]);

  const initialType = initial?.type ?? defaults?.type ?? 'EXPENSE';
  const { control, handleSubmit, setError, setValue, formState } = useForm<TransactionFormValues, unknown, TransactionFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: initialType,
      amount: initial ? toInputString(initial.amount) : '',
      accountId: initial?.accountId ?? defaults?.accountId ?? accounts[0]?.account.id ?? null,
      counterAccountId: initial?.counterAccountId ?? null,
      categoryId: initial?.categoryId ?? null,
      date: initial ? localDayKey(initial.occurredAt) : todayLocal(),
      description: initial?.description ?? '',
      // Las transferencias no se asocian a grupos.
      reimbursementGroupId: initialType === 'TRANSFER' ? null : (initial?.reimbursementGroupId ?? defaults?.reimbursementGroupId ?? null),
    },
  });
  const type = useWatch({ control, name: 'type' });
  const accountId = useWatch({ control, name: 'accountId' });
  const isTransfer = type === 'TRANSFER';

  const accountOptions = accounts.map(({ account, label }) => ({
    value: account.id,
    label,
    icon: accountTypeMeta[account.type].icon,
    color: account.color ?? undefined,
  }));
  const kindCategories = categories.filter((c) => c.kind === type);

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(toTransactionInput(values, initial));
    } catch (error) {
      if (error instanceof ValidationError) {
        setError((error.field as keyof TransactionFormValues) || 'amount', { message: error.message });
      } else throw error;
    }
  });

  return (
    <View style={{ gap: theme.spacing(4) }}>
      <Controller
        control={control}
        name="type"
        render={({ field }) => (
          <SegmentedControl
            options={typeOptions}
            value={field.value}
            accessibilityLabel="Tipo de movimiento"
            onChange={(next) => {
              field.onChange(next);
              // La categoría depende del tipo; la cuenta destino y el grupo solo aplican a ciertos tipos.
              setValue('categoryId', null);
              if (next !== 'TRANSFER') setValue('counterAccountId', null);
              else setValue('reimbursementGroupId', null);
            }}
          />
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
              onBlur={field.onBlur}
              hasError={!!fieldState.error}
              autoFocus={!initial}
              accessibilityLabel="Monto"
            />
          </FormField>
        )}
      />

      <GlassCard>
        <View style={{ gap: theme.spacing(4) }}>
          <Controller
            control={control}
            name="accountId"
            render={({ field, fieldState }) => (
              <FormField label={isTransfer ? 'Desde' : 'Cuenta'} error={fieldState.error?.message}>
                <Select
                  title={isTransfer ? 'Cuenta de origen' : 'Cuenta'}
                  value={field.value}
                  options={accountOptions}
                  hasError={!!fieldState.error}
                  onChange={(v) => {
                    field.onChange(v);
                    setValue('counterAccountId', null);
                  }}
                />
              </FormField>
            )}
          />
          {isTransfer ? (
            <Controller
              control={control}
              name="counterAccountId"
              render={({ field, fieldState }) => (
                <FormField label="Hacia" error={fieldState.error?.message}>
                  <Select
                    title="Cuenta destino"
                    value={field.value}
                    options={accountOptions.filter((o) => o.value !== accountId)}
                    hasError={!!fieldState.error}
                    onChange={field.onChange}
                  />
                </FormField>
              )}
            />
          ) : null}
        </View>
      </GlassCard>

      {!isTransfer ? (
        <Controller
          control={control}
          name="categoryId"
          render={({ field, fieldState }) => (
            <FormField label="Categoría" error={fieldState.error?.message}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) }} accessibilityRole="radiogroup">
                {kindCategories.map((c) => (
                  <CategoryChip
                    key={c.id}
                    category={c}
                    selected={field.value === c.id}
                    onPress={() => field.onChange(field.value === c.id ? null : c.id)}
                  />
                ))}
              </View>
            </FormField>
          )}
        />
      ) : null}

      <GlassCard>
        <View style={{ gap: theme.spacing(4) }}>
          <Controller
            control={control}
            name="date"
            render={({ field, fieldState }) => (
              <FormField label="Fecha" error={fieldState.error?.message}>
                <DateInput value={field.value} onChange={field.onChange} hasError={!!fieldState.error} accessibilityLabel="Fecha" />
              </FormField>
            )}
          />
          <Controller
            control={control}
            name="description"
            render={({ field, fieldState }) => (
              <FormField label="Descripción (opcional)" error={fieldState.error?.message}>
                <TextField
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  placeholder="¿En qué fue?"
                  maxLength={500}
                  accessibilityLabel="Descripción"
                />
              </FormField>
            )}
          />
          {!isTransfer && renderGroupField ? (
            <Controller
              control={control}
              name="reimbursementGroupId"
              render={({ field }) => <>{renderGroupField({ value: field.value, onChange: field.onChange })}</>}
            />
          ) : null}
        </View>
      </GlassCard>

      <Button label={submitLabel} icon="checkmark" onPress={submit} disabled={formState.isSubmitting} />
    </View>
  );
}

function CategoryChip({ category, selected, onPress }: { category: Category; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  const color = category.color ?? theme.colors.accent;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={category.name}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: theme.layout.minTouchTarget,
        paddingHorizontal: theme.spacing(3),
        borderRadius: theme.radii.pill,
        borderWidth: 1,
        borderColor: selected ? color : theme.colors.border,
        backgroundColor: selected ? `${color}33` : pressed ? theme.colors.surfacePressed : theme.colors.surface,
      })}>
      <Icon name={(category.icon as IconName | null) ?? 'pricetag-outline'} size={16} color={color} />
      <AppText variant="bodyStrong" color={selected ? theme.colors.text : theme.colors.textMuted}>
        {category.name}
      </AppText>
    </Pressable>
  );
}
