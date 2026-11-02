import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useRef } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';

import { AmountInput, AppText, Button, DateInput, FormField, GlassCard, SegmentedControl, Select, TextField } from '@/components/ui';
import { todayLocal } from '@/lib/dates';
import { toInputString } from '@/lib/money';
import { useTheme } from '@/theme';

import { ValidationError } from '../../data/FinanceRepository';
import { cdtOrigin, defaultMaturesOn } from '../../domain/cdts';
import { maturityValue } from '../../domain/cdtValuation';
import { cdtFormSchema, interestPayments, type CdtFormOutput, type CdtFormValues } from '../../domain/schemas/cdt';
import type { Cdt, CdtInput } from '../../domain/types';
import { useAccountOptions } from '../../hooks/useAccounts';
import { interestPaymentLabels } from './labels';
import { MaturityValueField, useMaturityValue } from './MaturityValueField';

type Props = {
  /** Periodo a editar; sin él, el formulario crea un CDT nuevo. */
  initial?: Cdt;
  onSubmit: (input: CdtInput) => Promise<unknown>;
};

const originLabels = { TRANSFER: 'Transferencia desde una cuenta', EXISTING: 'CDT existente (sin movimiento)' } as const;

function defaults(initial: Cdt | undefined, firstAccountId: string | null): CdtFormValues {
  const today = todayLocal();
  if (!initial) {
    return {
      issuer: '',
      certificateNumber: '',
      origin: 'TRANSFER',
      sourceAccountId: firstAccountId,
      principal: '',
      annualRateEa: '',
      termDays: '180',
      openedOn: today,
      maturesOn: defaultMaturesOn(today, 180),
      interestPayment: 'AT_MATURITY',
      withholdingRate: '4',
      payoutAccountId: null,
      maturityValue: '',
      maturityValueEdited: false,
    };
  }
  const origin = cdtOrigin(initial);
  return {
    issuer: initial.issuer,
    certificateNumber: initial.certificateNumber ?? '',
    origin: origin === 'TRANSFER' ? 'TRANSFER' : 'EXISTING',
    sourceAccountId: initial.sourceAccountId,
    principal: toInputString(initial.principal),
    annualRateEa: String(Number(initial.annualRateEa)).replace('.', ','),
    termDays: String(initial.termDays),
    openedOn: initial.openedOn,
    maturesOn: initial.maturesOn,
    interestPayment: initial.interestPayment,
    withholdingRate: String(Number(initial.withholdingRate)).replace('.', ','),
    payoutAccountId: initial.payoutAccountId,
    maturityValue: toInputString(maturityValue(initial)),
    maturityValueEdited: initial.maturityValueOverride !== null,
  };
}

/** Creación y edición de un CDT (spec 009, contracts/ui.md). */
export function CdtForm({ initial, onSubmit }: Props) {
  const theme = useTheme();
  const editing = !!initial;
  const accounts = useAccountOptions((a) => a.nature === 'ASSET' && a.type !== 'INVESTMENT' && a.type !== 'POCKET');
  const { control, handleSubmit, setValue, setError, formState } = useForm<CdtFormValues, unknown, CdtFormOutput>({
    resolver: zodResolver(cdtFormSchema),
    defaultValues: defaults(initial, accounts[0]?.account.id ?? null),
  });

  // El vencimiento se recalcula (días comerciales) mientras el usuario no lo edite a mano.
  const maturesTouched = useRef(editing);
  const [openedOn, termDays, origin, principal, annualRateEa, withholdingRate, maturity, maturityEdited] = useWatch({
    control,
    name: ['openedOn', 'termDays', 'origin', 'principal', 'annualRateEa', 'withholdingRate', 'maturityValue', 'maturityValueEdited'],
  });
  useEffect(() => {
    const days = Number(termDays);
    if (!maturesTouched.current && Number.isInteger(days) && days > 0 && /^\d{4}-\d{2}-\d{2}$/.test(openedOn)) {
      setValue('maturesOn', defaultMaturesOn(openedOn, days));
    }
  }, [openedOn, termDays, setValue]);

  const valuation = useMaturityValue({
    terms: { principal, annualRateEa, termDays, withholdingRate },
    value: maturity,
    edited: maturityEdited,
    setValue: useCallback((text: string) => setValue('maturityValue', text), [setValue]),
    setEdited: useCallback((edited: boolean) => setValue('maturityValueEdited', edited), [setValue]),
  });

  const accountOptions = accounts.map(({ account, label }) => ({ value: account.id, label }));
  const submit = handleSubmit(async (v) => {
    try {
      await onSubmit({
        ...v,
        // La nominal se deriva en el repositorio (FR-010).
        annualRateNominal: initial?.annualRateNominal ?? '0.0001',
        status: initial?.status ?? 'ACTIVE',
        renewedFromCdtId: initial?.renewedFromCdtId ?? null,
        sourceAccountId: initial && cdtOrigin(initial) === 'RENEWAL' ? null : v.sourceAccountId,
        settledGrossInterest: initial?.settledGrossInterest ?? null,
        settledWithholding: initial?.settledWithholding ?? null,
        settledNetInterest: initial?.settledNetInterest ?? null,
      });
    } catch (error) {
      if (error instanceof ValidationError) setError((error.field as keyof CdtFormValues) || 'issuer', { message: error.message });
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
              placeholder="10,25"
              accessibilityLabel={label}
            />
          </FormField>
        )}
      />
    </View>
  );

  const renewalOrigin = initial && cdtOrigin(initial) === 'RENEWAL';

  return (
    <View style={{ gap: theme.spacing(4) }}>
      <GlassCard>
        <View style={{ gap: theme.spacing(4) }}>
          {text('issuer', 'Entidad emisora', 'Bancolombia')}
          {text('certificateNumber', 'Número de título (opcional)', 'CDT-0001')}
        </View>
      </GlassCard>

      <GlassCard>
        <View style={{ gap: theme.spacing(4) }}>
          <FormField label="Origen del dinero">
            {editing ? (
              <AppText variant="bodyStrong">{renewalOrigin ? 'Renovación' : originLabels[origin]}</AppText>
            ) : (
              <Controller
                control={control}
                name="origin"
                render={({ field }) => (
                  <SegmentedControl
                    accessibilityLabel="Origen del dinero"
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { value: 'TRANSFER', label: 'Transferencia' },
                      { value: 'EXISTING', label: 'CDT existente' },
                    ]}
                  />
                )}
              />
            )}
          </FormField>
          {origin === 'TRANSFER' && !renewalOrigin ? (
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
          ) : !editing ? (
            <AppText variant="caption" tone="muted">
              No se crea ningún movimiento: el CDT entra a tu patrimonio con su capital como saldo inicial.
            </AppText>
          ) : null}
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
                hint="Se calcula con días comerciales (30 por mes); puedes ajustarla.">
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

      <Button label={editing ? 'Guardar cambios' : 'Crear CDT'} icon="checkmark" onPress={submit} disabled={formState.isSubmitting} />
    </View>
  );
}
