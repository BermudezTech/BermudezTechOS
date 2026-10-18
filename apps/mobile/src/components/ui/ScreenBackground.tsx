import { LinearGradient } from 'expo-linear-gradient';
import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { useTheme } from '@/theme';

/** Halo difuso con degradado radial (sin blur, barato en Android). */
function Glow({ color, opacity, style }: { color: string; opacity: number; style: object }) {
  // Id único por instancia: en web, un degradado definido en una pantalla oculta no se pinta.
  const id = `glow-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <Svg width={560} height={560} style={[styles.glow, style]}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="0.55" stopColor={color} stopOpacity={opacity * 0.35} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={280} cy={280} r={280} fill={`url(#${id})`} />
    </Svg>
  );
}

/** Degradado vibrante con dos halos de color detrás de cada pantalla. */
export function ScreenBackground() {
  const theme = useTheme();
  const glow = theme.scheme === 'dark' ? 0.55 : 0.4;
  return (
    <View style={[StyleSheet.absoluteFill, styles.clip]} pointerEvents="none">
      <LinearGradient
        colors={theme.colors.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Glow color={theme.colors.accent} opacity={glow} style={styles.top} />
      <Glow color={theme.colors.accentAlt} opacity={glow * 0.8} style={styles.bottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  glow: { position: 'absolute' },
  top: { top: -260, right: -200 },
  bottom: { bottom: -280, left: -220 },
});
