import { View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';

import { AppText } from '@/components/ui';
import { abbreviateCop, type Cents } from '@/lib/money';
import { useTheme } from '@/theme';

import type { SpendingItem } from '../../domain/spending';

export function categoryColor(item: Pick<SpendingItem, 'color'>, index: number, palette: string[]): string {
  return item.color ?? palette[index % palette.length]!;
}

/** Dona de distribución por categoría. Los valores numéricos solo se usan para dibujar. */
export function CategoryDonut({ items, total, size = 220 }: { items: SpendingItem[]; total: Cents; size?: number }) {
  const theme = useTheme();
  const radius = size / 2;
  return (
    <View
      style={{ alignItems: 'center' }}
      accessible
      accessibilityLabel={`Distribución del gasto: ${items.map((i) => `${i.name} ${i.pct.toFixed(0)} %`).join(', ')}`}>
      <PieChart
        donut
        radius={radius}
        innerRadius={radius * 0.68}
        innerCircleColor={theme.colors.surfaceStrong}
        strokeWidth={2}
        strokeColor={theme.colors.background}
        data={items.map((item, i) => ({
          value: Math.max(item.amount, 1) / 100,
          color: categoryColor(item, i, theme.colors.categoryPalette),
        }))}
        centerLabelComponent={() => (
          <View style={{ alignItems: 'center' }}>
            <AppText variant="caption" tone="muted">
              Total
            </AppText>
            <AppText variant="heading">{abbreviateCop(total)}</AppText>
          </View>
        )}
      />
    </View>
  );
}
