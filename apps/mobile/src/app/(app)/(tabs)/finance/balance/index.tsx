import { router } from 'expo-router';

import { Amount, AppText, GlassCard, ListItem, Screen, SectionHeader } from '@/components/ui';
import { periodLabel } from '@/lib/dates';
import { BalanceDeltaText } from '@/modules/finance/components/balance/BalanceDeltaText';
import { BalanceEvolutionChart } from '@/modules/finance/components/balance/BalanceEvolutionChart';
import { DeltaText } from '@/modules/finance/components/spending/DeltaText';
import { PeriodSwitcher } from '@/modules/finance/components/spending/PeriodSwitcher';
import { useBalance } from '@/modules/finance/hooks/useBalance';
import { useFirstActivityMonth } from '@/modules/finance/hooks/useMonthSummary';
import { usePeriodParams } from '@/modules/finance/hooks/usePeriodParams';
import { useTheme } from '@/theme';

export default function BalanceScreen() {
  const theme = useTheme();
  const firstMonth = useFirstActivityMonth();
  const [period, setPeriod] = usePeriodParams(firstMonth);
  const { report, evolution } = useBalance(period);
  const previousLabel = period.granularity === 'MONTH' ? 'vs. mes anterior' : 'vs. año anterior';
  const params = `granularity=${period.granularity}&anchor=${period.anchor}`;

  return (
    <Screen title="Balance" subtitle="Ingresos − gastos" back>
      <PeriodSwitcher period={period} onChange={setPeriod} min={firstMonth} />

      <GlassCard>
        <AppText variant="caption" tone="muted">
          Balance · {periodLabel(period)}
        </AppText>
        <Amount value={report.balance} variant="auto" size="large" />
        <BalanceDeltaText delta={report.balanceDelta} suffix={previousLabel} />
      </GlassCard>

      <GlassCard padded={false} style={{ padding: theme.spacing(2) }}>
        <ListItem
          title="Ingresos"
          icon="arrow-down-circle-outline"
          iconColor={theme.colors.income}
          meta={<DeltaText delta={report.incomeDelta} suffix={previousLabel} goodWhen="up" />}
          right={<Amount value={report.income} variant="income" />}
          chevron
          onPress={() => router.push(`/finance/income?${params}`)}
        />
        <ListItem
          title="Gastos"
          icon="arrow-up-circle-outline"
          iconColor={theme.colors.expense}
          meta={<DeltaText delta={report.expenseDelta} suffix={previousLabel} />}
          right={<Amount value={report.expense} variant="expense" />}
          chevron
          onPress={() => router.push(`/finance/spending?${params}`)}
        />
      </GlassCard>

      <SectionHeader title={period.granularity === 'MONTH' ? 'Últimos 6 meses' : 'Últimos 6 años'} />
      <GlassCard>
        <BalanceEvolutionChart points={evolution} />
      </GlassCard>
    </Screen>
  );
}
