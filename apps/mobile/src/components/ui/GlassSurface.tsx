import { BlurView } from 'expo-blur';
import { Platform, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { useBlurTarget } from './BlurTarget';

type Props = ViewProps & {
  /**
   * `blur`: desenfoque real; usar solo en superficies flotantes (nav, modales, FAB).
   * `tinted`: "glass simulado" translúcido sin blur, para tarjetas y listas (research R7).
   */
  variant?: 'blur' | 'tinted';
  /** Superficie más opaca (modales, hojas, nav). */
  strong?: boolean;
  radius?: number;
  shadow?: boolean;
};

export function GlassSurface({ variant = 'tinted', strong, radius, shadow = true, style, children, ...rest }: Props) {
  const theme = useTheme();
  const blurTarget = useBlurTarget();
  const borderRadius = radius ?? theme.radii.lg;
  const frame: StyleProp<ViewStyle> = {
    borderRadius,
    borderWidth: theme.glass.borderWidth,
    borderColor: theme.colors.border,
  };

  const canBlur = variant === 'blur' && (Platform.OS !== 'android' || blurTarget !== null);
  if (canBlur) {
    return (
      <View style={[frame, shadow && theme.glass.shadow, style]} {...rest}>
        <BlurView
          intensity={theme.glass.blurIntensity}
          tint={theme.scheme === 'dark' ? 'dark' : 'light'}
          blurMethod="dimezisBlurViewSdk31Plus"
          blurTarget={blurTarget ?? undefined}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius,
            overflow: 'hidden',
            backgroundColor: strong ? theme.colors.surface : 'transparent',
          }}
        />
        {children}
      </View>
    );
  }

  return (
    <View
      style={[
        frame,
        { backgroundColor: strong || variant === 'blur' ? theme.colors.surfaceStrong : theme.colors.surface },
        shadow && theme.glass.shadow,
        style,
      ]}
      {...rest}>
      {children}
    </View>
  );
}
