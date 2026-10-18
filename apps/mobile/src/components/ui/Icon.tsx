import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type Props = { name: IconName; size?: number; color?: string };

export function Icon({ name, size = 20, color }: Props) {
  const theme = useTheme();
  return <Ionicons name={name} size={size} color={color ?? theme.colors.text} accessibilityElementsHidden importantForAccessibility="no" />;
}

/** Ícono dentro de un círculo de color suave. `color` debe ser hexadecimal (#RRGGBB). */
export function IconBadge({ name, color, size = 40 }: { name: IconName; color?: string; size?: number }) {
  const theme = useTheme();
  const tint = color ?? theme.colors.accent;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `${tint}26`,
      }}>
      <Icon name={name} size={size * 0.5} color={tint} />
    </View>
  );
}
