import { View } from 'react-native';

import { Amount, AppText, EmptyState, GlassCard, Screen, SectionHeader, useIsWide } from '@/components/ui';
import { periodLabel } from '@/lib/dates';
import { CategoryBreakdownList } from '@/modules/finance/components/spending/CategoryBreakdownList';
import { CategoryDonut } from '@/modules/finance/components/spending/CategoryDonut';
import { DeltaText } from '@/modules/finance/components/spending/DeltaText';
import { EvolutionChart } from '@/modules/finance/components/spending/EvolutionChart';
import { PeriodSwitcher } from '@/modules/finance/components/spending/PeriodSwitcher';
import { useIncomeByCategory } from '@/modules/finance/hooks/useIncome';
import { useFirstActivityMonth } from '@/modules/finance/hooks/useMonthSummary';
import { usePeriodParams } from '@/modules/finance/hooks/usePeriodParams';
import { useTheme } from '@/theme';

export default function IncomeScreen() {
  const theme = useTheme();
  const wide = useIsWide();
  const firstMonth = useFirstActivityMonth();
  const [period, setPeriod] = usePeriodParams(firstMonth);
  const { report, evolution } = useIncomeByCategory(period);
  const previousLabel = period.granularity === 'MONTH' ? 'vs. mes anterior' : 'vs. año anterior';

  return (
    <Screen title="Ingresos por categoría" subtitle="Sin transferencias ni reembolsables" back>
      <PeriodSwitcher period={period} onChange={setPeriod} min={firstMonth} />

      <GlassCard>
        <AppText variant="caption" tone="muted">
          Ingreso total · {periodLabel(period)}
        </AppText>
        <Amount value={report.total} size="large" />
        <DeltaText delta={report.delta} suffix={previousLabel} goodWhen="up" />
      </GlassCard>

      {report.items.length === 0 ? (
        <EmptyState
          icon="cash-outline"
          title="Sin ingresos en este periodo"
          message="Cuando registres ingresos, verás aquí su distribución por categoría."
        />
      ) : (
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: theme.spacing(4), alignItems: wide ? 'flex-start' : 'stretch' }}>
          <GlassCard style={wide ? { flex: 1 } : undefined}>
            <CategoryDonut items={report.items} total={report.total} />
          </GlassCard>
          <GlassCard padded={false} style={[{ padding: theme.spacing(2) }, wide ? { flex: 1.3 } : null]}>
            <CategoryBreakdownList items={report.items} period={period} basePath="/finance/income" />
          </GlassCard>
        </View>
      )}

      <SectionHeader title={period.granularity === 'MONTH' ? 'Últimos 6 meses' : 'Últimos 6 años'} />
      <GlassCard>
        <EvolutionChart points={evolution} accessibilityPrefix="Evolución del ingreso" color={theme.colors.income} />
      </GlassCard>
    </Screen>
  );
}
