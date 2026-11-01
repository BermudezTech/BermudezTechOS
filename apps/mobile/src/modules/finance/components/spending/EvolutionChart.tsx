import { View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

import { abbreviateCop, cents } from '@/lib/money';
import { periodShortLabel } from '@/lib/dates';
import { useTheme } from '@/theme';

import type { EvolutionPoint } from '../../domain/spending';
import { useWidth } from './useWidth';

type Props = {
  points: EvolutionPoint[];
  /** Inicio de la descripción accesible, p. ej. "Evolución del gasto". */
  accessibilityPrefix: string;
  /** Hexadecimal (#RRGGBB); por defecto el acento. */
  color?: string;
};

/** Barras con el total de los últimos periodos; el actual resaltado. */
export function EvolutionChart({ points, accessibilityPrefix, color }: Props) {
  const theme = useTheme();
  const tint = color ?? theme.colors.accent;
  const { width, onLayout } = useWidth();
  const yAxisWidth = 56;
  // gifted-charts añade márgenes internos al ancho indicado.
  const usable = Math.max(180, width - yAxisWidth - 48);
  const barWidth = Math.min(36, (usable / points.length) * 0.55);
  const spacing = usable / points.length - barWidth;

  return (
    <View
      onLayout={onLayout}
      style={{ overflow: 'hidden' }}
      accessible
      accessibilityLabel={`${accessibilityPrefix}: ${points.map((p) => `${periodShortLabel(p.period)} ${abbreviateCop(p.total)}`).join(', ')}`}>
      <BarChart
        data={points.map((p, i) => ({
          value: p.total / 100,
          label: periodShortLabel(p.period),
          frontColor: i === points.length - 1 ? tint : `${tint}66`,
        }))}
        width={usable}
        height={170}
        barWidth={barWidth}
        spacing={spacing}
        initialSpacing={spacing / 2}
        barBorderRadius={8}
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
    </View>
  );
}
