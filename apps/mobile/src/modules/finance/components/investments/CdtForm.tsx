import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';

import { AmountInput, Button, DateInput, FormField, GlassCard, Select, TextField } from '@/components/ui';
import { todayLocal } from '@/lib/dates';
import { useTheme } from '@/theme';

import { ValidationError } from '../../data/FinanceRepository';
import { defaultMaturesOn } from '../../domain/cdts';
import { cdtFormSchema, interestPayments, type CdtFormOutput, type CdtFormValues } from '../../domain/schemas/cdt';
import type { CdtInput } from '../../domain/types';
import { useAccountOptions } from '../../hooks/useAccounts';
import { interestPaymentLabels } from './labels';

type Props = { onSubmit: (input: CdtInput) => Promise<unknown> };

export function CdtForm({ onSubmit }: Props) {
  const theme = useTheme();
  const accounts = useAccountOptions((a) => a.nature === 'ASSET' && a.type !== 'INVESTMENT' && a.type !== 'POCKET');
  const today = todayLocal();
  const { control, handleSubmit, setValue, setError, formState } = useForm<CdtFormValues, unknown, CdtFormOutput>({
    resolver: zodResolver(cdtFormSchema),
    defaultValues: {
      issuer: '',
      certificateNumber: '',
      principal: '',
      annualRateEa: '',
      annualRateNominal: '',
      termDays: '180',
      openedOn: today,
      maturesOn: defaultMaturesOn(today, 180),
      interestPayment: 'AT_MATURITY',
      withholdingRate: '4',
      sourceAccountId: accounts[0]?.account.id ?? null,
      payoutAccountId: accounts[0]?.account.id ?? null,
    },
  });

  // El vencimiento se recalcula con apertura + plazo mientras el usuario no lo edite a mano.
  const maturesTouched = useRef(false);
  const openedOn = useWatch({ control, name: 'openedOn' });
  const termDays = useWatch({ control, name: 'termDays' });
  useEffect(() => {
    const days = Number(termDays);
    if (!maturesTouched.current && Number.isInteger(days) && days > 0 && /^\d{4}-\d{2}-\d{2}$/.test(openedOn)) {
      setValue('maturesOn', defaultMaturesOn(openedOn, days));
    }
  }, [openedOn, termDays, setValue]);

  const accountOptions = accounts.map(({ account, label }) => ({ value: account.id, label }));
  const submit = handleSubmit(async (v) => {
    try {
      await onSubmit({ ...v, sourceAccountId: v.sourceAccountId, status: 'ACTIVE', renewedFromCdtId: null });
    } catch (error) {
      if (error instanceof ValidationError) setError((error.field as keyof CdtFormValues) ?? 'issuer', { message: error.message });
      else throw error;
    }
  });

  const text = (name: 'issuer' | 'certificateNumber', label: string, placeholder: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormField label={label} error={fieldState.error?.message}>
          <TextField
            value={field.value}
            onChangeText={field.onChange}
            hasError={!!fieldState.error}
            placeholder={placeholder}
            accessibilityLabel={label}
          />
        </FormField>
      )}
    />
  );
  const rate = (name: 'annualRateEa' | 'annualRateNominal' | 'withholdingRate', label: string) => (
    <View style={{ flexGrow: 1, flexBasis: 140 }}>
      <Controller
        control={control}
        name={name}
        render={({ field, fieldState }) => (
          <FormField label={label} error={fieldState.error?.message}>
            <TextField
              value={field.value}
              onChangeText={field.onChange}
              hasError={!!fieldState.error}
              keyboardType="decimal-pad"
              inputMode="decimal"
              placeholder="10,25"
              accessibilityLabel={label}
            />
          </FormField>
        )}
      />
    </View>
  );

  return (
    <View style={{ gap: theme.spacing(4) }}>
      <GlassCard>
        <View style={{ gap: theme.spacing(4) }}>
          {text('issuer', 'Entidad emisora', 'Bancolombia')}
          {text('certificateNumber', 'Número de título (opcional)', 'CDT-0001')}
          <Controller
            control={control}
            name="principal"
            render={({ field, fieldState }) => (
              <FormField label="Capital invertido" error={fieldState.error?.message}>
                <AmountInput
                  value={field.value}
                  onChangeText={field.onChange}
                  hasError={!!fieldState.error}
                  large={false}
                  accessibilityLabel="Capital invertido"
                />
              </FormField>
            )}
          />
        </View>
      </GlassCard>

      <GlassCard>
        <View style={{ gap: theme.spacing(4) }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(3) }}>
            {rate('annualRateEa', 'Tasa E.A. (%)')}
            {rate('annualRateNominal', 'Tasa nominal (%)')}
          </View>
          <Controller
            control={control}
            name="interestPayment"
            render={({ field }) => (
              <FormField label="Pago de intereses">
                <Select
                  title="Pago de intereses"
                  value={field.value}
                  options={interestPayments.map((p) => ({ value: p, label: interestPaymentLabels[p] }))}
                  onChange={(v) => v && field.onChange(v)}
                />
              </FormField>
            )}
          />
          {rate('withholdingRate', 'Retención en la fuente (%)')}
        </View>
      </GlassCard>

      <GlassCard>
        <View style={{ gap: theme.spacing(4) }}>
          <Controller
            control={control}
            name="termDays"
            render={({ field, fieldState }) => (
              <FormField label="Plazo (días)" error={fieldState.error?.message}>
                <TextField
                  value={field.value}
                  onChangeText={field.onChange}
                  hasError={!!fieldState.error}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  accessibilityLabel="Plazo en días"
                />
              </FormField>
            )}
          />
          <Controller
            control={control}
            name="openedOn"
            render={({ field, fieldState }) => (
              <FormField label="Fecha de apertura" error={fieldState.error?.message}>
                <DateInput value={field.value} onChange={field.onChange} accessibilityLabel="Fecha de apertura" />
              </FormField>
            )}
          />
          <Controller
            control={control}
            name="maturesOn"
            render={({ field, fieldState }) => (
              <FormField
                label="Fecha de vencimiento"
                error={fieldState.error?.message}
                hint="Se calcula con la apertura y el plazo; puedes ajustarla.">
                <DateInput
                  value={field.value}
                  hasError={!!fieldState.error}
                  onChange={(v) => {
                    maturesTouched.current = true;
                    field.onChange(v);
                  }}
                  accessibilityLabel="Fecha de vencimiento"
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
            name="sourceAccountId"
            render={({ field, fieldState }) => (
              <FormField
                label="Cuenta de origen"
                error={fieldState.error?.message}
                hint="El capital sale de esta cuenta (transferencia de apertura).">
                <Select
                  title="Cuenta de origen"
                  value={field.value}
                  options={accountOptions}
                  hasError={!!fieldState.error}
                  onChange={field.onChange}
                />
              </FormField>
            )}
          />
          <Controller
            control={control}
            name="payoutAccountId"
            render={({ field }) => (
              <FormField label="Cuenta destino al vencer">
                <Select
                  title="Cuenta destino"
                  value={field.value}
                  options={accountOptions}
                  clearLabel="Sin definir"
                  onChange={field.onChange}
                />
              </FormField>
            )}
          />
        </View>
      </GlassCard>

      <Button label="Crear CDT" icon="checkmark" onPress={submit} disabled={formState.isSubmitting} />
    </View>
  );
}
