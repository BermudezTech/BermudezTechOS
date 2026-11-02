import { router } from 'expo-router';
import { View } from 'react-native';

import { Amount, AppText, GlassCard } from '@/components/ui';
import { formatDateLocal } from '@/lib/dates';
import { formatCop, max, type Cents } from '@/lib/money';
import { useInitialSync } from '@/sync/hooks';
import { useTheme } from '@/theme';

import { useAmountVisible } from '../../hooks/useAmountVisibility';
import { useHomeMonthFlow } from '../../hooks/useHomeFinance';
import { HIDDEN_AMOUNT, WidgetHeader } from './WidgetHeader';

/** Ancho de la barra en % respecto al mayor de los dos; solo presentación (data-model, MonthFlow). */
function barPercent(value: Cents, largest: Cents): number {
  return largest > 0 ? Math.round((value / largest) * 100) : 0;
}

function FlowRow({
  label,
  value,
  largest,
  color,
  visible,
}: {
  label: string;
  value: Cents;
  largest: Cents;
  color: string;
  visible: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing(1) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing(2) }}>
        <AppText variant="caption" tone="muted">
          {label}
        </AppText>
        {visible ? <Amount value={value} variant="default" /> : <AppText variant="amount">{HIDDEN_AMOUNT}</AppText>}
      </View>
      <View style={{ height: 8, borderRadius: theme.radii.pill, backgroundColor: theme.colors.border, overflow: 'hidden' }}>
        <View style={{ width: `${barPercent(value, largest)}%`, height: '100%', borderRadius: theme.radii.pill, backgroundColor: color }} />
      </View>
    </View>
  );
}

/** Inicio → Este mes: ingresos vs. gastos del mes en curso y balance neto; abre Balance (spec 010, US2). */
export function MonthFlowWidget() {
  const theme = useTheme();
  const visible = useAmountVisible('home-month-flow');
  const { month, income, expense, balance, hasData } = useHomeMonthFlow();
  // Sin movimientos durante la primera descarga, los ceros aún no son definitivos (research R9).
  const loading = useInitialSync().downloading && !hasData;
  const monthLabel = formatDateLocal(month, 'MMMM yyyy');
  const largest = max(income, expense);
  const summary = visible
    ? `ingresos ${formatCop(income)}, gastos ${formatCop(expense)}, balance ${formatCop(balance)}`
    : 'valores ocultos';

  return (
    <GlassCard
      onPress={() => router.push({ pathname: '/finance/balance', params: { granularity: 'MONTH', anchor: month } })}
      accessibilityLabel={`Este mes, ${monthLabel}: ${summary}. Ver balance`}>
      <View style={{ gap: theme.spacing(3) }}>
        <WidgetHeader icon="swap-vertical" iconColor={theme.colors.transfer} title={`Este mes · ${monthLabel}`} />
        {loading ? (
          <AppText tone="muted">Cargando…</AppText>
        ) : (
          <>
            <FlowRow label="Ingresos" value={income} largest={largest} color={theme.colors.income} visible={visible} />
            <FlowRow label="Gastos" value={expense} largest={largest} color={theme.colors.expense} visible={visible} />
            <View style={{ height: 1, backgroundColor: theme.colors.border }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing(2) }}>
              <AppText variant="bodyStrong">Balance</AppText>
              {visible ? <Amount value={balance} variant="auto" /> : <AppText variant="amount">{HIDDEN_AMOUNT}</AppText>}
            </View>
          </>
        )}
      </View>
    </GlassCard>
  );
}
