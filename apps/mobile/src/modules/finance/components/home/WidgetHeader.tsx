import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppText, IconBadge, type IconName } from '@/components/ui';
import { useTheme } from '@/theme';

/** Valor que se muestra en lugar de un monto oculto (igual que las tarjetas del hub). */
export const HIDDEN_AMOUNT = '$ ******';

/** Encabezado común de los widgets de Inicio: ícono, título y contenido opcional a la derecha. */
export function WidgetHeader({ icon, iconColor, title, right }: { icon: IconName; iconColor?: string; title: string; right?: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3) }}>
      <IconBadge name={icon} color={iconColor} />
      <AppText variant="caption" tone="muted" style={{ flex: 1 }} numberOfLines={1}>
        {title}
      </AppText>
      {right}
    </View>
  );
}
