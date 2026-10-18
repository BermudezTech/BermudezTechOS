import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMotionEnabled, useTheme } from '@/theme';

import { Icon } from './Icon';
import { useNavInset } from './layout';

/** Botón de acción rápida para registrar un movimiento (FR-015). */
export function Fab({ onPress, accessibilityLabel = 'Nuevo movimiento' }: { onPress: () => void; accessibilityLabel?: string }) {
  const theme = useTheme();
  const motion = useMotionEnabled();
  const insets = useSafeAreaInsets();
  const navInset = useNavInset();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.wrap, { right: theme.spacing(5), bottom: Math.max(navInset, insets.bottom) + theme.spacing(4) }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          if (motion) scale.set(withSpring(0.9, theme.motion.spring));
        }}
        onPressOut={() => {
          if (motion) scale.set(withSpring(1, theme.motion.spring));
        }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={[styles.button, { backgroundColor: theme.colors.accent, borderColor: 'rgba(255,255,255,0.35)' }, theme.glass.shadow]}>
        <Icon name="add" size={30} color={theme.colors.textOnAccent} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
  button: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
