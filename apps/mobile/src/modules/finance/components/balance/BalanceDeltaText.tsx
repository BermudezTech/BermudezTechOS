import { View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import { formatCop } from '@/lib/money';
import { useTheme } from '@/theme';

import type { BalanceDelta } from '../../domain/monthSummary';
import { DeltaText } from '../spending/DeltaText';

/** Variación del balance: porcentaje, o diferencia en pesos si el balance anterior era ≤ 0 (research R5). */
export function BalanceDeltaText({ delta, suffix }: { delta: BalanceDelta; suffix: string }) {
  const theme = useTheme();
  if (delta === null) return null;
  if (delta.kind === 'pct') return <DeltaText delta={delta.value} suffix={suffix} goodWhen="up" />;
  const up = delta.value > 0;
  const color = delta.value === 0 ? theme.colors.textMuted : up ? theme.colors.income : theme.colors.expense;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <Icon name={delta.value === 0 ? 'remove' : up ? 'arrow-up' : 'arrow-down'} size={12} color={color} />
      <AppText variant="caption" color={color}>
        {formatCop(delta.value, { hideZeroCents: true, signDisplay: 'always' })} {suffix}
      </AppText>
    </View>
  );
}
