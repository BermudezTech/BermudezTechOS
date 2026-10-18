import { View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import { formatDateLocal } from '@/lib/dates';
import { abbreviateCop, cents } from '@/lib/money';
import { useTheme } from '@/theme';

import type { NetWorthPoint } from '../../domain/netWorth';
import { useWidth } from '../spending/useWidth';

export function NetWorthChart({ points }: { points: NetWorthPoint[] }) {
  const theme = useTheme();
  const { width, onLayout } = useWidth();
  const yAxisWidth = 56;
  // gifted-charts añade márgenes internos al ancho indicado.
  const usable = Math.max(180, width - yAxisWidth - 48);
  const spacing = usable / Math.max(1, points.length - 1) - 1;
  const values = points.map((p) => p.netWorth / 100);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const pad = (maxValue - minValue) * 0.15 || Math.abs(maxValue) * 0.1 || 1;

  return (
    <View
      onLayout={onLayout}
      style={{ overflow: 'hidden' }}
      accessible
      accessibilityLabel={`Evolución del patrimonio: ${points.map((p) => `${formatDateLocal(p.date, 'MMM')} ${abbreviateCop(p.netWorth)}`).join(', ')}`}>
      <LineChart
        data={points.map((p, i) => ({
          value: p.netWorth / 100 - (minValue - pad),
          label: i % 2 === 1 ? formatDateLocal(p.date, 'MMM') : '',
        }))}
        width={usable}
        height={180}
        spacing={spacing}
        initialSpacing={4}
        endSpacing={4}
        areaChart
        curved
        color={theme.colors.accent}
        thickness={3}
        startFillColor={theme.colors.accent}
        endFillColor={theme.colors.accent}
        startOpacity={0.35}
        endOpacity={0.02}
        hideDataPoints
        noOfSections={4}
        maxValue={maxValue - minValue + pad * 2}
        yAxisLabelWidth={yAxisWidth}
        yAxisThickness={0}
        xAxisThickness={0}
        rulesColor={theme.colors.border}
        yAxisTextStyle={{ color: theme.colors.textMuted, fontSize: 10 }}
        xAxisLabelTextStyle={{ color: theme.colors.textMuted, fontSize: 10, width: 40 }}
        formatYLabel={(label) => abbreviateCop(cents(Math.round((Number(label) + minValue - pad) * 100))).replace('$ ', '')}
        disableScroll
      />
    </View>
  );
}
