import { View } from 'react-native';

import { useTheme } from '@/theme';

/** `value` entre 0 y 1 (se recorta). */
export function ProgressBar({ value, color, accessibilityLabel }: { value: number; color?: string; accessibilityLabel?: string }) {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{ height: 10, borderRadius: theme.radii.pill, backgroundColor: theme.colors.surfacePressed, overflow: 'hidden' }}>
      <View
        style={{
          width: `${clamped * 100}%`,
          height: '100%',
          borderRadius: theme.radii.pill,
          backgroundColor: color ?? theme.colors.accent,
        }}
      />
    </View>
  );
}
