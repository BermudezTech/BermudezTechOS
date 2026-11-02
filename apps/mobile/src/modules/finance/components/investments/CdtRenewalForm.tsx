import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';

import {
  Amount,
  AmountInput,
  AppText,
  Badge,
  Button,
  DateInput,
  FormField,
  GlassCard,
  SegmentedControl,
  Select,
  TextField,
} from '@/components/ui';
import { formatDateLocal } from '@/lib/dates';
import { parseAmount, toInputString, type Cents } from '@/lib/money';
import { useTheme } from '@/theme';

import { ValidationError } from '../../data/FinanceRepository';
import { defaultMaturesOn, renewalPrincipal, type CdtValues } from '../../domain/cdts';
import { settlement } from '../../domain/cdtValuation';
import { cdtRenewalFormSchema, interestPayments, type CdtRenewalFormOutput, type CdtRenewalFormValues } from '../../domain/schemas/cdt';
import type { CdtRenewalInput, RenewalOperation } from '../../domain/types';
import { useAccountOptions } from '../../hooks/useAccounts';
import { formatRate, interestPaymentLabels } from './labels';
import { MaturityValueField, useMaturityValue } from './MaturityValueField';

type Props = {
  /** Periodo que termina. */
  values: CdtValues;
  onSubmit: (input: CdtRenewalInput) => Promise<unknown>;
};

const rateText = (rate: string) => String(Number(rate)).replace('.', ',');
const amountOf = (text: string): Cents | null => {
  const parsed = parseAmount(text);
  return parsed.ok ? parsed.value : null;
};

/** Renovación de un CDT vencido (spec 009, contracts/ui.md, research R4). */
export function CdtRenewalForm({ values, onSubmit }: Props) {
  const theme = useTheme();
  const previous = values.cdt;
  const accounts = useAccountOptions((a) => a.nature === 'ASSET' && a.type !== 'INVESTMENT' && a.type !== 'POCKET');
  const accountOptions = accounts.map(({ account, label }) => ({ value: account.id, label }));
  const initialValue = toInputString(values.maturityValue);

  const { control, handleSubmit, setValue, getValues, setError, formState } = useForm<CdtRenewalFormValues, unknown, CdtRenewalFormOutput>({
    resolver: zodResolver(cdtRenewalFormSchema),
    defaultValues: {
      previousPrincipal: previous.principal,
      previousMaturityValue: initialValue,
      operation: 'RENEW',
      amount: '',
      adjustmentAccountId: null,
      principal: initialValue,
      annualRateEa: rateText(previous.annualRateEa),
      termDays: String(previous.termDays),
      withholdingRate: rateText(previous.withholdingRate),
      openedOn: previous.maturesOn,
      maturesOn: defaultMaturesOn(previous.maturesOn, previous.termDays),
      maturityValue: '',
      maturityValueEdited: false,
      interestPayment: previous.interestPayment,
      payoutAccountId: previous.payoutAccountId,
      certificateNumber: previous.certificateNumber ?? '',
    },
  });

  const [previousValueText, operation, principal, annualRateEa, termDays, withholdingRate, openedOn, maturity, maturityEdited] = useWatch({
    control,
    name: [
      'previousMaturityValue',
      'operation',
      'principal',
      'annualRateEa',
      'termDays',
      'withholdingRate',
      'openedOn',
      'maturityValue',
      'maturityValueEdited',
    ],
  });

  // Vencimiento del nuevo periodo con días comerciales, mientras no se edite a mano.
  const maturesTouched = useRef(false);
  useEffect(() => {
    const days = Number(termDays);
    if (!maturesTouched.current && Number.isInteger(days) && days > 0 && /^\d{4}-\d{2}-\d{2}$/.test(openedOn)) {
      setValue('maturesOn', defaultMaturesOn(openedOn, days));
    }
  }, [openedOn, termDays, setValue]);

  // Capital nuevo = valor final anterior ± ajuste mientras no se edite. Si el banco reporta otro
  // capital, la diferencia se registra como un movimiento de ajuste: el periodo anterior no cambia.
  const [principalEdited, setPrincipalEdited] = useState(false);
  const syncPrincipal = (next: { value?: string; operation?: RenewalOperation; amount?: string }) => {
    if (principalEdited) return;
    const value = amountOf(next.value ?? getValues('previousMaturityValue'));
    const op = next.operation ?? getValues('operation');
    const amount = amountOf(next.amount ?? getValues('amount'));
    if (value !== null) setValue('principal', toInputString(renewalPrincipal(value, op, amount)));
  };
  const expectedPrincipal = (() => {
    const value = amountOf(previousValueText);
    return value === null ? null : renewalPrincipal(value, operation, amountOf(getValues('amount')));
  })();
  const principalValue = amountOf(principal);
  const difference = expectedPrincipal !== null && principalValue !== null ? principalValue - expectedPrincipal : 0;
  const resetPrincipal = () => {
    setPrincipalEdited(false);
    if (expectedPrincipal !== null) setValue('principal', toInputString(expectedPrincipal));
  };

  const previousValue = amountOf(previousValueText);
  const closing = previousValue !== null && previousValue >= previous.principal ? settlement(previous, previousValue) : null;
  const previousAdjusted = previousValue !== null && previousValue !== values.maturityValue;

  const valuation = useMaturityValue({
    terms: { principal, annualRateEa, termDays, withholdingRate },
    value: maturity,
    edited: maturityEdited,
    setValue: useCallback((text: string) => setValue('maturityValue', text), [setValue]),
    setEdited: useCallback((edited: boolean) => setValue('maturityValueEdited', edited), [setValue]),
  });

  const submit = handleSubmit(async (v) => {
    try {
      await onSubmit({
        previousMaturityValue: v.previousMaturityValue,
        operation: v.operation,
        amount: v.amount,
        adjustmentAccountId: v.adjustmentAccountId,
        principal: v.principal,
        annualRateEa: v.annualRateEa,
        termDays: v.termDays,
        withholdingRate: v.withholdingRate,
        openedOn: v.openedOn,
        maturesOn: v.maturesOn,
        maturityValueOverride: v.maturityValueOverride,
        interestPayment: v.interestPayment,
        payoutAccountId: v.payoutAccountId,
        certificateNumber: v.certificateNumber,
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        setError((error.field as keyof CdtRenewalFormValues) || 'previousMaturityValue', { message: error.message });
      } else throw error;
    }
  });

  const rate = (name: 'annualRateEa' | 'withholdingRate', label: string) => (
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
        <View style={{ gap: theme.spacing(3) }}>
          <AppText variant="bodyStrong">Periodo que termina</AppText>
          <Row label="Capital" value={<Amount value={previous.principal} hideZeroCents={false} />} />
          <Row label="Venció el" text={formatDateLocal(previous.maturesOn, "d 'de' MMMM 'de' yyyy")} />
          <Controller
            control={control}
            name="previousMaturityValue"
            render={({ field, fieldState }) => (
              <FormField
                label="Valor final (neto)"
                error={fieldState.error?.message}
                hint="Prellenado con el valor esperado; ajústalo al que reporta el banco.">
                <AmountInput
                  value={field.value}
                  onChangeText={(text) => {
                    field.onChange(text);
                    syncPrincipal({ value: text });
                  }}
                  hasError={!!fieldState.error}
                  large={false}
                  accessibilityLabel="Valor final del periodo que termina"
                />
              </FormField>
            )}
          />
          {previousAdjusted ? <Badge label="Ajustado al banco" tone="info" icon="create-outline" /> : null}
          {closing ? (
            <>
              <Row label="Interés neto" value={<Amount value={closing.net} variant="income" hideZeroCents={false} />} />
              <Row
                label={`Retención (${formatRate(previous.withholdingRate)})`}
                value={<Amount value={closing.withholding} variant="expense" hideZeroCents={false} />}
              />
              <Row label="Interés bruto" value={<Amount value={closing.gross} hideZeroCents={false} />} />
            </>
          ) : null}
        </View>
      </GlassCard>

      <GlassCard>
        <View style={{ gap: theme.spacing(4) }}>
          <Controller
            control={control}
            name="operation"
            render={({ field }) => (
              <FormField label="Operación">
                <SegmentedControl
                  accessibilityLabel="Operación de renovación"
                  value={field.value}
                  onChange={(op) => {
                    field.onChange(op);
                    if (op === 'WITHDRAW' && !getValues('adjustmentAccountId')) setValue('adjustmentAccountId', previous.payoutAccountId);
                    syncPrincipal({ operation: op });
                  }}
                  options={[
                    { value: 'RENEW', label: 'Solo renovar' },
                    { value: 'ADD', label: 'Agregar' },
                    { value: 'WITHDRAW', label: 'Retirar' },
                  ]}
                />
              </FormField>
            )}
          />
          {operation === 'RENEW' ? (
            <AppText variant="caption" tone="muted">
              El capital y los intereses netos se quedan en el CDT. No necesitas elegir ninguna cuenta.
            </AppText>
          ) : (
            <>
              <Controller
                control={control}
                name="amount"
                render={({ field, fieldState }) => (
                  <FormField label={operation === 'ADD' ? 'Monto a agregar' : 'Monto a retirar'} error={fieldState.error?.message}>
                    <AmountInput
                      value={field.value}
                      onChangeText={(text) => {
                        field.onChange(text);
                        syncPrincipal({ amount: text });
                      }}
                      hasError={!!fieldState.error}
                      large={false}
                      accessibilityLabel={operation === 'ADD' ? 'Monto a agregar' : 'Monto a retirar'}
                    />
                  </FormField>
                )}
              />
              <Controller
                control={control}
                name="adjustmentAccountId"
                render={({ field, fieldState }) => (
                  <FormField label={operation === 'ADD' ? 'Cuenta de origen' : 'Cuenta destino'} error={fieldState.error?.message}>
                    <Select
                      title={operation === 'ADD' ? 'Cuenta de origen' : 'Cuenta destino'}
                      value={field.value}
                      options={accountOptions}
                      hasError={!!fieldState.error}
                      onChange={field.onChange}
                    />
                  </FormField>
                )}
              />
            </>
          )}
        </View>
      </GlassCard>

      <GlassCard>
        <View style={{ gap: theme.spacing(4) }}>
          <AppText variant="bodyStrong">Nuevo periodo</AppText>
          <Controller
            control={control}
            name="principal"
            render={({ field, fieldState }) => (
              <FormField
                label="Capital"
                error={fieldState.error?.message}
                hint="Valor final ± aporte o retiro. Ajústalo si el banco reporta otro capital.">
                <AmountInput
                  value={field.value}
                  onChangeText={(text) => {
                    field.onChange(text);
                    setPrincipalEdited(true);
                  }}
                  hasError={!!fieldState.error}
                  large={false}
                  accessibilityLabel="Capital del nuevo periodo"
                />
              </FormField>
            )}
          />
          {principalEdited && difference !== 0 ? (
            <View style={{ gap: theme.spacing(2) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: theme.spacing(2) }}>
                <Badge label="Ajustado al banco" tone="info" icon="create-outline" />
                <AppText variant="caption" tone="muted" style={{ flexShrink: 1 }}>
                  Se registrará un ajuste de
                </AppText>
                <Amount value={Math.abs(difference) as Cents} variant={difference > 0 ? 'income' : 'expense'} hideZeroCents={false} />
              </View>
              <AppText variant="caption" tone="muted">
                El cierre del periodo anterior no se modifica.
              </AppText>
              <Button label="Usar valor final ± ajuste" icon="refresh" variant="ghost" compact onPress={resetPrincipal} />
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(3) }}>
            {rate('annualRateEa', 'Tasa E.A. (%)')}
            {rate('withholdingRate', 'Retención en la fuente (%)')}
          </View>
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
              <FormField label="Inicio" error={fieldState.error?.message}>
                <DateInput value={field.value} onChange={field.onChange} accessibilityLabel="Inicio del nuevo periodo" />
              </FormField>
            )}
          />
          <Controller
            control={control}
            name="maturesOn"
            render={({ field, fieldState }) => (
              <FormField label="Vencimiento" error={fieldState.error?.message} hint="Días comerciales (30 por mes); puedes ajustarlo.">
                <DateInput
                  value={field.value}
                  hasError={!!fieldState.error}
                  onChange={(v) => {
                    maturesTouched.current = true;
                    field.onChange(v);
                  }}
                  accessibilityLabel="Vencimiento del nuevo periodo"
                />
              </FormField>
            )}
          />
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
          <Controller
            control={control}
            name="payoutAccountId"
            render={({ field }) => (
              <FormField label="Cuenta destino al vencer (opcional)">
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
          <Controller
            control={control}
            name="certificateNumber"
            render={({ field, fieldState }) => (
              <FormField label="Número de título (opcional)" error={fieldState.error?.message}>
                <TextField
                  value={field.value}
                  onChangeText={field.onChange}
                  hasError={!!fieldState.error}
                  accessibilityLabel="Número de título"
                />
              </FormField>
            )}
          />
        </View>
      </GlassCard>

      <GlassCard>
        <Controller
          control={control}
          name="maturityValue"
          render={({ fieldState }) => (
            <MaturityValueField
              label="Valor neto al vencimiento"
              value={maturity}
              edited={maturityEdited}
              error={fieldState.error?.message}
              state={valuation}
            />
          )}
        />
      </GlassCard>

      <Button label="Renovar CDT" icon="refresh" onPress={submit} disabled={formState.isSubmitting} />
    </View>
  );
}

function Row({ label, text, value }: { label: string; text?: string; value?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <AppText tone="muted" style={{ flex: 1 }}>
        {label}
      </AppText>
      {value ?? (
        <AppText variant="bodyStrong" style={{ flexShrink: 1, textAlign: 'right' }}>
          {text}
        </AppText>
      )}
    </View>
  );
}
