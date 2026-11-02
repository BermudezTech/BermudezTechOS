import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { AmountInput, AppText, Badge, Button, FormField } from '@/components/ui';
import { parseAmount, toInputString, type Cents } from '@/lib/money';
import { useTheme } from '@/theme';

import { calculatedMaturityValue, nominalFromEa, nominalFromMaturityValue } from '../../domain/cdtValuation';
import { rateField } from '../../domain/schemas/common';
import { formatRate } from './labels';

export interface TermsText {
  principal: string;
  annualRateEa: string;
  termDays: string;
  withholdingRate: string;
}

const parseRate = (value: string, allowZero = false) => {
  const r = rateField(4, { allowZero }).safeParse(value);
  return r.success ? r.data : null;
};

/** Términos del formulario ya convertidos, o `null` si alguno aún no es válido. */
function parseTerms(t: TermsText) {
  const principal = parseAmount(t.principal);
  const annualRateEa = parseRate(t.annualRateEa);
  const withholdingRate = parseRate(t.withholdingRate, true);
  const termDays = Number(t.termDays);
  if (!principal.ok || principal.value <= 0 || !annualRateEa || withholdingRate === null) return null;
  if (!Number.isInteger(termDays) || termDays < 1 || termDays > 3650) return null;
  return { principal: principal.value, annualRateEa, withholdingRate, termDays };
}

/**
 * Valor neto al vencimiento en vivo (spec 009, FR-009 a FR-011): mientras no se edite, sigue al
 * cálculo; si se editó y luego cambian los términos, marca `stale` para ofrecer "Recalcular".
 */
export function useMaturityValue({
  terms,
  value,
  edited,
  setValue,
  setEdited,
}: {
  terms: TermsText;
  value: string;
  edited: boolean;
  setValue: (text: string) => void;
  setEdited: (edited: boolean) => void;
}) {
  const parsed = useMemo(() => parseTerms(terms), [terms.principal, terms.annualRateEa, terms.termDays, terms.withholdingRate]); // eslint-disable-line react-hooks/exhaustive-deps
  const calculated: Cents | null = parsed ? calculatedMaturityValue(parsed) : null;
  const termsKey = `${terms.principal}|${terms.annualRateEa}|${terms.termDays}|${terms.withholdingRate}`;
  // Términos con los que se ajustó el valor a mano; si cambian, se ofrece recalcular.
  const [editedAt, setEditedAt] = useState<string | null>(edited ? termsKey : null);

  useEffect(() => {
    if (!edited && calculated !== null) setValue(toInputString(calculated));
  }, [edited, calculated, setValue]);

  const amount = parseAmount(value);
  const nominal = !parsed
    ? null
    : edited && amount.ok && amount.value >= parsed.principal
      ? nominalFromMaturityValue(parsed, amount.value)
      : nominalFromEa(parsed.annualRateEa, parsed.termDays);

  return {
    nominal,
    stale: edited && editedAt !== null && editedAt !== termsKey,
    onEdit: (text: string) => {
      if (!edited) setEditedAt(termsKey);
      setEdited(true);
      setValue(text);
    },
    recalculate: () => {
      setEditedAt(null);
      setEdited(false);
      if (calculated !== null) setValue(toInputString(calculated));
    },
  };
}

type Props = {
  label: string;
  value: string;
  edited: boolean;
  error?: string;
  state: ReturnType<typeof useMaturityValue>;
};

/** Campo "Valor neto al vencimiento" + tasa nominal derivada (solo lectura). */
export function MaturityValueField({ label, value, edited, error, state }: Props) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing(3) }}>
      <FormField
        label={label}
        error={error}
        hint={edited ? undefined : 'Calculado con capital, TEA, plazo y retención. Ajústalo si el banco reporta otro valor.'}>
        <AmountInput value={value} onChangeText={state.onEdit} hasError={!!error} large={false} accessibilityLabel={label} />
      </FormField>
      {edited ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: theme.spacing(2) }}>
          <Badge label="Ajustado al banco" tone="info" icon="create-outline" />
          {state.stale ? (
            <>
              <AppText variant="caption" tone="muted" style={{ flexShrink: 1 }}>
                El valor final fue ajustado a mano.
              </AppText>
              <Button label="Recalcular" icon="refresh" variant="ghost" compact onPress={state.recalculate} />
            </>
          ) : (
            <Button label="Usar el calculado" icon="refresh" variant="ghost" compact onPress={state.recalculate} />
          )}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <AppText tone="muted">Tasa nominal (calculada)</AppText>
        <AppText variant="bodyStrong">{state.nominal ? formatRate(state.nominal) : '—'}</AppText>
      </View>
    </View>
  );
}
