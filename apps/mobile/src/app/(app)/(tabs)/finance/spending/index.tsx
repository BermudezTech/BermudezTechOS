import { View } from 'react-native';

import { Amount, AppText, EmptyState, GlassCard, Screen, SectionHeader, useIsWide } from '@/components/ui';
import { periodLabel } from '@/lib/dates';
import { CategoryBreakdownList } from '@/modules/finance/components/spending/CategoryBreakdownList';
import { CategoryDonut } from '@/modules/finance/components/spending/CategoryDonut';
import { DeltaText } from '@/modules/finance/components/spending/DeltaText';
import { EvolutionChart } from '@/modules/finance/components/spending/EvolutionChart';
import { PeriodSwitcher } from '@/modules/finance/components/spending/PeriodSwitcher';
import { usePeriodParams } from '@/modules/finance/hooks/usePeriodParams';
import { useSpendingByCategory } from '@/modules/finance/hooks/useSpending';
import { useTheme } from '@/theme';

export default function SpendingScreen() {
  const theme = useTheme();
  const wide = useIsWide();
  const [period, setPeriod] = usePeriodParams();
  const { report, evolution } = useSpendingByCategory(period);
  const previousLabel = period.granularity === 'MONTH' ? 'vs. mes anterior' : 'vs. año anterior';

  return (
    <Screen title="Gastos por categoría" subtitle="Sin transferencias, pagos de tarjeta ni reembolsables" back>
      <PeriodSwitcher period={period} onChange={setPeriod} />

      <GlassCard>
        <AppText variant="caption" tone="muted">
          Gasto total · {periodLabel(period)}
        </AppText>
        <Amount value={report.total} size="large" />
        <DeltaText delta={report.delta} suffix={previousLabel} />
      </GlassCard>

      {report.items.length === 0 ? (
        <EmptyState
          icon="pie-chart-outline"
          title="Sin gastos en este periodo"
          message="Cuando registres egresos, verás aquí su distribución por categoría."
        />
      ) : (
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: theme.spacing(4), alignItems: wide ? 'flex-start' : 'stretch' }}>
          <GlassCard style={wide ? { flex: 1 } : undefined}>
            <CategoryDonut items={report.items} total={report.total} />
          </GlassCard>
          <GlassCard padded={false} style={[{ padding: theme.spacing(2) }, wide ? { flex: 1.3 } : null]}>
            <CategoryBreakdownList items={report.items} period={period} />
          </GlassCard>
        </View>
      )}

      <SectionHeader title={period.granularity === 'MONTH' ? 'Últimos 6 meses' : 'Últimos 6 años'} />
      <GlassCard>
        <EvolutionChart points={evolution} />
      </GlassCard>
    </Screen>
  );
}
