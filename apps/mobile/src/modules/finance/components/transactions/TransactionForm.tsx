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
import { formatCop, toInputString } from '@/lib/money';
import { useTheme } from '@/theme';

import { ValidationError } from '../../data/FinanceRepository';
import { hasEntryInPeriod, periodFor, prefillFrom } from '../../domain/recurringIncomes';
import {
  toTransactionInput,
  transactionFormSchema,
  type TransactionFormOutput,
  type TransactionFormValues,
} from '../../domain/schemas/transaction';
import type { Account, Category, RecurringIncome, Transaction, TransactionInput, TransactionType } from '../../domain/types';
import { useActiveTransactions } from '../../hooks/useFinanceData';
import { useRecurringIncomeLookup } from '../../hooks/useRecurringIncomes';
import { accountTypeMeta } from '../accounts/accountMeta';
import { RecurringIncomePicker } from '../recurringIncome/RecurringIncomePicker';

export type TransactionFormDefaults = {
  type?: TransactionType;
  accountId?: string | null;
  reimbursementGroupId?: string | null;
  /** Plantilla preseleccionada (`?recurringIncomeId=`); prellena el formulario. */
  recurringIncomeId?: string | null;
};

type Props = {
  initial?: Transaction;
  defaults?: TransactionFormDefaults;
  accounts: { account: Account; label: string }[];
  categories: Category[];
  /** Plantillas activas que ofrece el selector (solo al crear un ingreso). */
  recurringIncomes?: RecurringIncome[];
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

export function TransactionForm({
  initial,
  defaults,
  accounts,
  categories,
  recurringIncomes = [],
  onSubmit,
  submitLabel = 'Guardar',
  renderGroupField,
}: Props) {
  const theme = useTheme();
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const schema = useMemo(() => transactionFormSchema(categoryMap), [categoryMap]);

  const lookupRecurringIncome = useRecurringIncomeLookup();
  const transactions = useActiveTransactions();

  const preset = !initial && defaults?.recurringIncomeId ? recurringIncomes.find((r) => r.id === defaults.recurringIncomeId) : undefined;
  const prefill = preset ? prefillFrom(preset, todayLocal()) : undefined;
  const initialType = preset ? 'INCOME' : (initial?.type ?? defaults?.type ?? 'EXPENSE');
  const { control, handleSubmit, setError, setValue, formState } = useForm<TransactionFormValues, unknown, TransactionFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: initialType,
      amount: initial ? toInputString(initial.amount) : prefill ? toInputString(prefill.amount) : '',
      accountId: initial?.accountId ?? prefill?.accountId ?? defaults?.accountId ?? accounts[0]?.account.id ?? null,
      counterAccountId: initial?.counterAccountId ?? null,
      categoryId: initial?.categoryId ?? prefill?.categoryId ?? null,
      date: initial ? localDayKey(initial.occurredAt) : todayLocal(),
      description: initial?.description ?? prefill?.description ?? '',
      recurringIncomeId: initial?.recurringIncomeId ?? preset?.id ?? null,
      // Las transferencias no se asocian a grupos.
      reimbursementGroupId: initialType === 'TRANSFER' ? null : (initial?.reimbursementGroupId ?? defaults?.reimbursementGroupId ?? null),
    },
  });
  const type = useWatch({ control, name: 'type' });
  const accountId = useWatch({ control, name: 'accountId' });
  const isTransfer = type === 'TRANSFER';
  const recurringIncomeId = useWatch({ control, name: 'recurringIncomeId' });
  const date = useWatch({ control, name: 'date' });
  const linked = type === 'INCOME' && recurringIncomeId ? lookupRecurringIncome(recurringIncomeId) : undefined;
  const linkedPeriod = linked ? periodFor(linked.cycle, date) : null;
  const duplicate = linked && linkedPeriod ? hasEntryInPeriod(transactions, linked.id, linkedPeriod, initial?.id) : false;
  const showPicker = !initial && type === 'INCOME' && recurringIncomes.length > 0;

  const selectRecurringIncome = (id: string | null) => {
    setValue('recurringIncomeId', id);
    const template = id ? recurringIncomes.find((r) => r.id === id) : undefined;
    // Al quitar la selección solo se borra el vínculo; los campos quedan como estén (research R3).
    if (!template) return;
    const values = prefillFrom(template, todayLocal());
    setValue('amount', toInputString(values.amount));
    setValue('accountId', values.accountId);
    setValue('categoryId', values.categoryId);
    setValue('description', values.description);
    setValue('date', values.date);
  };

  const accountOptions = accounts.map(({ account, label }) => ({
    value: account.id,
    label,
    icon: accountTypeMeta[account.type].icon,
    color: account.color ?? undefined,
  }));
  const kindCategories = categories.filter((c) => c.kind === type);

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(toTransactionInput(values, initial, (id) => lookupRecurringIncome(id)?.cycle));
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
              if (next !== 'INCOME') setValue('recurringIncomeId', null);
              if (next !== 'TRANSFER') setValue('counterAccountId', null);
              else setValue('reimbursementGroupId', null);
            }}
          />
        )}
      />

      {showPicker ? (
        <RecurringIncomePicker value={recurringIncomeId ?? null} options={recurringIncomes} onChange={selectRecurringIncome} />
      ) : null}

      <Controller
        control={control}
        name="amount"
        render={({ field, fieldState }) => (
          <FormField
            label="Monto"
            error={fieldState.error?.message}
            hint={linked ? `Valor esperado: ${formatCop(linked.expectedAmount, { hideZeroCents: true })}` : undefined}>
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
      {duplicate && linked ? (
        <AppText variant="caption" tone="warning">
          Ya registraste {linked.name} en {linkedPeriod}. Puedes guardarlo de todas formas.
        </AppText>
      ) : null}

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
