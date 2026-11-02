import { router } from 'expo-router';
import { View } from 'react-native';

import { Amount, AppText, Badge, Button, confirm, GlassCard, notify, ProgressBar } from '@/components/ui';
import { formatDateLocal } from '@/lib/dates';
import { formatCop, type Cents } from '@/lib/money';
import { useTheme } from '@/theme';

import { ValidationError } from '../../data/FinanceRepository';
import { cdtOrigin, type CdtValues } from '../../domain/cdts';
import { maturityValue } from '../../domain/cdtValuation';
import type { Account, Cdt } from '../../domain/types';
import { cdtDeletionPreview, deleteCdt } from '../../hooks/useCdts';
import { cdtStatusLabels, formatRate, interestPaymentLabels } from './labels';

type Props = { values: CdtValues; accounts: Map<string, Account> };

const longDate = (date: string) => formatDateLocal(date, "d 'de' MMMM 'de' yyyy");

/** Valor final de un periodo: el liquidado si ya se renovó, si no el esperado. */
const periodValue = (cdt: Cdt): Cents =>
  cdt.settledNetInterest !== null ? ((cdt.principal + cdt.settledNetInterest) as Cents) : maturityValue(cdt);

export function CdtDetailPanel({ values, accounts }: Props) {
  const theme = useTheme();
  const { cdt, chain } = values;
  const active = cdt.status === 'ACTIVE';
  const progress = cdt.termDays ? values.daysElapsed / cdt.termDays : 0;
  const origin = cdtOrigin(cdt);
  const previous = chain.length > 1 ? chain[chain.length - 2] : undefined;
  const accountName = (id: string | null) => (id ? (accounts.get(id)?.name ?? '—') : 'Sin definir');
  const originText =
    origin === 'TRANSFER'
      ? `Transferencia desde ${accountName(cdt.sourceAccountId)}`
      : origin === 'EXISTING'
        ? 'CDT existente (sin movimiento)'
        : `Renovación del ${previous ? longDate(previous.openedOn) : 'periodo anterior'}`;

  const onDelete = async () => {
    const preview = cdtDeletionPreview(cdt.id);
    if (!preview.allowed) {
      notify('No se puede borrar este CDT', preview.reason);
      return;
    }
    const movements = preview.transactionCount === 1 ? '1 movimiento asociado' : `${preview.transactionCount} movimientos asociados`;
    const ok = await confirm({
      title: origin === 'RENEWAL' ? '¿Deshacer esta renovación?' : `¿Borrar el CDT ${cdt.issuer}?`,
      message: `Se borrará el CDT y ${movements}. Esta acción no se puede deshacer.`,
      confirmLabel: 'Borrar',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteCdt(cdt.id);
      if (cdt.renewedFromCdtId) router.replace(`/finance/investments/${cdt.renewedFromCdtId}`);
      else router.replace('/finance/investments');
    } catch (error) {
      if (error instanceof ValidationError) notify('No se pudo borrar el CDT', error.message);
      else throw error;
    }
  };

  return (
    <View style={{ gap: theme.spacing(4) }}>
      <GlassCard>
        <View style={{ gap: theme.spacing(3) }}>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Badge label={cdtStatusLabels[cdt.status]} tone={active ? 'success' : 'neutral'} />
            {values.canRenew ? (
              <Badge label="Vencido: listo para renovar" tone="accent" icon="refresh" />
            ) : values.maturingSoon ? (
              <Badge label={`Vence en ${values.daysRemaining} días`} tone="warning" icon="time-outline" />
            ) : null}
            {values.isOverridden ? <Badge label="Ajustado al banco" tone="info" icon="create-outline" /> : null}
          </View>
          <View>
            <AppText variant="caption" tone="muted">
              Valor neto esperado al vencimiento
            </AppText>
            <Amount value={periodValue(cdt)} size="large" hideZeroCents={false} />
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
          <Row label="Interés bruto al vencimiento" value={<Amount value={values.settlement.gross} hideZeroCents={false} />} />
          <Row
            label={`Retención en la fuente (${formatRate(cdt.withholdingRate)})`}
            value={<Amount value={values.settlement.withholding} variant="expense" hideZeroCents={false} />}
          />
          <Row label="Interés neto" value={<Amount value={values.settlement.net} variant="income" hideZeroCents={false} />} />
          <Row label="Valor neto al vencimiento" value={<Amount value={values.maturityValue} hideZeroCents={false} />} />
        </View>
      </GlassCard>

      <GlassCard>
        <View style={{ gap: theme.spacing(3) }}>
          <Row label="Entidad" text={cdt.issuer} />
          {cdt.certificateNumber ? <Row label="Número de título" text={cdt.certificateNumber} /> : null}
          <Row label="Origen" text={originText} />
          <Row label="Tasa efectiva anual (E.A.)" text={formatRate(cdt.annualRateEa)} />
          <Row label="Tasa nominal (calculada)" text={formatRate(cdt.annualRateNominal)} />
          <Row label="Plazo" text={`${cdt.termDays} días`} />
          <Row label="Apertura" text={longDate(cdt.openedOn)} />
          <Row label="Vencimiento" text={longDate(cdt.maturesOn)} />
          <Row label="Pago de intereses" text={interestPaymentLabels[cdt.interestPayment]} />
          <Row label="Cuenta destino al vencer" text={accountName(cdt.payoutAccountId)} />
        </View>
      </GlassCard>

      {active ? (
        <GlassCard>
          <View style={{ gap: theme.spacing(3) }}>
            <AppText variant="bodyStrong">Al vencer</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) }}>
              <Button
                label="Renovar"
                icon="refresh"
                variant={values.canRenew ? 'primary' : 'secondary'}
                disabled={!values.canRenew}
                onPress={() => router.push(`/finance/investments/${cdt.id}/renew`)}
              />
              <Button label="Registrar vencimiento" icon="checkmark-done-outline" variant="secondary" disabled onPress={() => {}} />
            </View>
            <AppText variant="caption" tone="muted">
              {values.canRenew
                ? 'Puedes agregar capital, retirar capital o renovar con capital e intereses.'
                : `Renovar estará disponible desde el ${longDate(cdt.maturesOn)}.`}{' '}
              Registrar vencimiento: disponible próximamente.
            </AppText>
          </View>
        </GlassCard>
      ) : null}

      {chain.length > 1 ? (
        <GlassCard>
          <View style={{ gap: theme.spacing(3) }}>
            <AppText variant="bodyStrong">Historial</AppText>
            {chain.map((period) => (
              <View key={period.id} style={{ gap: 2 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                  <AppText variant={period.id === cdt.id ? 'bodyStrong' : 'body'}>
                    {formatDateLocal(period.openedOn, 'd MMM yyyy')} → {formatDateLocal(period.maturesOn, 'd MMM yyyy')}
                  </AppText>
                  <Amount value={periodValue(period)} hideZeroCents={false} />
                </View>
                <AppText variant="caption" tone="muted">
                  Capital {formatCop(period.principal)} · {formatRate(period.annualRateEa)} E.A. · {cdtStatusLabels[period.status]}
                </AppText>
              </View>
            ))}
          </View>
        </GlassCard>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) }}>
        {active ? (
          <Button
            label="Editar"
            icon="create-outline"
            variant="secondary"
            onPress={() => router.push(`/finance/investments/${cdt.id}/edit`)}
          />
        ) : null}
        <Button
          label={origin === 'RENEWAL' ? 'Deshacer renovación' : 'Borrar CDT'}
          icon="trash-outline"
          variant="danger"
          onPress={onDelete}
        />
      </View>
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
