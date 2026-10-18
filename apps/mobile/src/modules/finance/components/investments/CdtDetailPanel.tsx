import { View } from 'react-native';

import { Amount, AppText, Badge, Button, GlassCard, ProgressBar } from '@/components/ui';
import { formatDateLocal } from '@/lib/dates';
import { useTheme } from '@/theme';

import type { CdtValues } from '../../domain/cdts';
import type { Account } from '../../domain/types';
import { cdtStatusLabels, formatRate, interestPaymentLabels } from './labels';

type Props = { values: CdtValues; accounts: Map<string, Account> };

export function CdtDetailPanel({ values, accounts }: Props) {
  const theme = useTheme();
  const { cdt } = values;
  const active = cdt.status === 'ACTIVE';
  const progress = cdt.termDays ? values.daysElapsed / cdt.termDays : 0;

  return (
    <View style={{ gap: theme.spacing(4) }}>
      <GlassCard>
        <View style={{ gap: theme.spacing(3) }}>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Badge label={cdtStatusLabels[cdt.status]} tone={active ? 'success' : 'neutral'} />
            {values.maturingSoon ? <Badge label={`Vence en ${values.daysRemaining} días`} tone="warning" icon="time-outline" /> : null}
          </View>
          <View>
            <AppText variant="caption" tone="muted">
              {active ? 'Valor actual estimado' : 'Valor neto al vencimiento'}
            </AppText>
            <Amount value={active ? values.currentValue : values.expectedNet} size="large" hideZeroCents={false} />
          </View>
          {active ? (
            <>
              <ProgressBar
                value={progress}
                color={theme.colors.accentAlt}
                accessibilityLabel={`Plazo transcurrido: ${values.daysElapsed} de ${cdt.termDays} días`}
              />
              <AppText variant="caption" tone="muted">
                Día {values.daysElapsed} de {cdt.termDays} · faltan {values.daysRemaining} días
              </AppText>
            </>
          ) : null}
        </View>
      </GlassCard>

      <GlassCard>
        <View style={{ gap: theme.spacing(3) }}>
          <Row label="Capital" value={<Amount value={cdt.principal} hideZeroCents={false} />} />
          <Row label="Interés causado a la fecha" value={<Amount value={values.accrued} variant="income" hideZeroCents={false} />} />
          <Row label="Interés total al vencimiento" value={<Amount value={values.totalInterest} hideZeroCents={false} />} />
          <Row
            label={`Retención en la fuente (${formatRate(cdt.withholdingRate)})`}
            value={<Amount value={values.withholding} variant="expense" hideZeroCents={false} />}
          />
          <Row label="Valor neto esperado al vencimiento" value={<Amount value={values.expectedNet} hideZeroCents={false} />} />
        </View>
      </GlassCard>

      <GlassCard>
        <View style={{ gap: theme.spacing(3) }}>
          <Row label="Entidad" text={cdt.issuer} />
          {cdt.certificateNumber ? <Row label="Número de título" text={cdt.certificateNumber} /> : null}
          <Row label="Tasa efectiva anual (E.A.)" text={formatRate(cdt.annualRateEa)} />
          <Row label="Tasa nominal" text={formatRate(cdt.annualRateNominal)} />
          <Row label="Plazo" text={`${cdt.termDays} días`} />
          <Row label="Apertura" text={formatDateLocal(cdt.openedOn, "d 'de' MMMM 'de' yyyy")} />
          <Row label="Vencimiento" text={formatDateLocal(cdt.maturesOn, "d 'de' MMMM 'de' yyyy")} />
          <Row label="Pago de intereses" text={interestPaymentLabels[cdt.interestPayment]} />
          <Row label="Cuenta de origen" text={accounts.get(cdt.sourceAccountId)?.name ?? '—'} />
          <Row
            label="Cuenta destino al vencer"
            text={cdt.payoutAccountId ? (accounts.get(cdt.payoutAccountId)?.name ?? '—') : 'Sin definir'}
          />
        </View>
      </GlassCard>

      {active ? (
        <GlassCard>
          <View style={{ gap: theme.spacing(3) }}>
            <AppText variant="bodyStrong">Al vencer</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) }}>
              <Button label="Registrar vencimiento" icon="checkmark-done-outline" variant="secondary" disabled onPress={() => {}} />
              <Button label="Renovar" icon="refresh" variant="secondary" disabled onPress={() => {}} />
            </View>
            <AppText variant="caption" tone="muted">
              Disponible próximamente.
            </AppText>
          </View>
        </GlassCard>
      ) : null}
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
