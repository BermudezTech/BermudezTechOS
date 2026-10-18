import { View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import { formatPercent } from '@/lib/money';
import { useTheme } from '@/theme';

import type { Delta } from '../../domain/spending';

type Props = {
  delta: Delta;
  suffix?: string;
  /** `down` (gastos): bajar es bueno. `up` (ingresos): subir es bueno. */
  goodWhen?: 'up' | 'down';
};

/** Variación con flecha y color (bueno = ingreso, malo = egreso). Texto + flecha, no solo color. */
export function DeltaText({ delta, suffix = 'vs. periodo anterior', goodWhen = 'down' }: Props) {
  const theme = useTheme();
  if (delta === null) return null;
  if (delta === 'new') {
    return (
      <AppText variant="caption" tone="muted">
        Nuevo {suffix ? `· ${suffix}` : ''}
      </AppText>
    );
  }
  const up = delta.gt(0);
  const good = goodWhen === 'up' ? up : !up;
  const color = delta.isZero() ? theme.colors.textMuted : good ? theme.colors.income : theme.colors.expense;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <Icon name={delta.isZero() ? 'remove' : up ? 'arrow-up' : 'arrow-down'} size={12} color={color} />
      <AppText variant="caption" color={color}>
        {formatPercent(delta.abs())} {suffix}
      </AppText>
    </View>
  );
}
