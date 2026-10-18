import type { ReactNode } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { GlassSurface } from './GlassSurface';

type Props = {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function GlassCard({ children, onPress, accessibilityLabel, padded = true, style }: Props) {
  const theme = useTheme();
  const padding = padded ? theme.spacing(4) : 0;
  if (!onPress) {
    return <GlassSurface style={[{ padding }, style]}>{children}</GlassSurface>;
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.985 : 1 }], opacity: pressed ? 0.9 : 1 }, style]}>
      <GlassSurface style={{ padding }}>{children}</GlassSurface>
    </Pressable>
  );
}
