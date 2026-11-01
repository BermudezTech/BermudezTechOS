import { View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

import { AppText } from '@/components/ui';
import { periodShortLabel } from '@/lib/dates';
import { abbreviateCop, cents } from '@/lib/money';
import { useTheme } from '@/theme';

import type { BalanceEvolutionPoint } from '../../domain/monthSummary';
import { useWidth } from '../spending/useWidth';

/** Barras agrupadas de ingresos y gastos por periodo, con el balance encima de cada grupo. */
export function BalanceEvolutionChart({ points }: { points: BalanceEvolutionPoint[] }) {
  const theme = useTheme();
  const { width, onLayout } = useWidth();
  const yAxisWidth = 56;
  // gifted-charts añade márgenes internos al ancho indicado.
  const usable = Math.max(180, width - yAxisWidth - 48);
  const group = usable / Math.max(1, points.length);
  const barWidth = Math.min(16, group * 0.3);
  const innerGap = 2;
  const outerGap = group - barWidth * 2 - innerGap;

  const data = points.flatMap((p) => [
    {
      value: p.income / 100,
      frontColor: theme.colors.income,
      spacing: innerGap,
      label: periodShortLabel(p.period),
      labelWidth: barWidth * 2 + innerGap + 8,
      topLabelComponent: () => (
        <AppText
          variant="caption"
          color={p.balance < 0 ? theme.colors.expense : theme.colors.textMuted}
          numberOfLines={1}
          style={{ fontSize: 9, width: barWidth * 2 + innerGap + outerGap, marginBottom: 2 }}>
          {abbreviateCop(p.balance).replace('$ ', '')}
        </AppText>
      ),
    },
    { value: p.expense / 100, frontColor: theme.colors.expense, spacing: outerGap },
  ]);

  return (
    <View
      onLayout={onLayout}
      style={{ overflow: 'hidden', gap: theme.spacing(2) }}
      accessible
      accessibilityLabel={`Evolución del balance: ${points
        .map(
          (p) =>
            `${periodShortLabel(p.period)} ingresos ${abbreviateCop(p.income)}, gastos ${abbreviateCop(p.expense)}, balance ${abbreviateCop(p.balance)}`,
        )
        .join('; ')}`}>
      <BarChart
        data={data}
        width={usable}
        height={170}
        barWidth={barWidth}
        initialSpacing={outerGap / 2}
        barBorderRadius={4}
        noOfSections={4}
        yAxisLabelWidth={yAxisWidth}
        yAxisThickness={0}
        xAxisThickness={0}
        rulesColor={theme.colors.border}
        yAxisTextStyle={{ color: theme.colors.textMuted, fontSize: 10 }}
        xAxisLabelTextStyle={{ color: theme.colors.textMuted, fontSize: 11 }}
        formatYLabel={(label) => abbreviateCop(cents(Math.round(Number(label) * 100))).replace('$ ', '')}
        disableScroll
        isAnimated
      />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: theme.spacing(4) }}>
        <Legend color={theme.colors.income} label="Ingresos" />
        <Legend color={theme.colors.expense} label="Gastos" />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1) }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
    </View>
  );
}
