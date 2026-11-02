import { router } from 'expo-router';
import { View } from 'react-native';

import { Amount, AppText, Button, GlassCard } from '@/components/ui';
import { useInitialSync } from '@/sync/hooks';
import { useTheme } from '@/theme';

import { useAmountVisible } from '../../hooks/useAmountVisibility';
import { useHomeNetWorth } from '../../hooks/useHomeFinance';
import { BalanceDeltaText } from '../balance/BalanceDeltaText';
import { NetWorthChart } from '../netWorth/NetWorthChart';
import { HIDDEN_AMOUNT, WidgetHeader } from './WidgetHeader';

const TITLE = 'Patrimonio neto';

/**
 * Inicio → Patrimonio neto: valor actual, variación vs. el cierre del mes anterior y gráfica de
 * 12 meses (spec 010, US1). Con los montos ocultos se oculta también la gráfica (research R6).
 */
export function NetWorthWidget() {
  const theme = useTheme();
  const visible = useAmountVisible('home-net-worth');
  const { netWorth, evolution, monthDelta, isEmpty } = useHomeNetWorth();
  const { downloading } = useInitialSync();
  const header = <WidgetHeader icon="analytics" iconColor={theme.colors.accentAlt} title={TITLE} />;

  // Durante la primera descarga, "sin datos" aún no es definitivo (research R9).
  if (isEmpty && downloading) {
    return (
      <GlassCard>
        <View style={{ gap: theme.spacing(3) }}>
          {header}
          <AppText tone="muted">Cargando…</AppText>
        </View>
      </GlassCard>
    );
  }

  if (isEmpty) {
    return (
      <GlassCard>
        <View style={{ gap: theme.spacing(3) }}>
          {header}
          <AppText variant="heading">Aún no hay patrimonio</AppText>
          <AppText tone="muted">Crea tu primera cuenta para ver tu patrimonio y cómo evoluciona mes a mes.</AppText>
          <Button label="Crear cuenta" icon="add" onPress={() => router.push('/finance/accounts/new')} />
        </View>
      </GlassCard>
    );
  }

  return (
    <GlassCard onPress={() => router.push('/finance/net-worth')} accessibilityLabel={`${TITLE}, ver detalle`}>
      <View style={{ gap: theme.spacing(2) }}>
        {header}
        {visible ? (
          <>
            <Amount value={netWorth} variant="auto" size="large" />
            <BalanceDeltaText delta={{ kind: 'abs', value: monthDelta }} suffix="vs. mes anterior" />
            <NetWorthChart points={evolution} height={120} />
          </>
        ) : (
          <AppText variant="amountLarge" accessibilityLabel={`${TITLE} oculto`}>
            {HIDDEN_AMOUNT}
          </AppText>
        )}
      </View>
    </GlassCard>
  );
}
