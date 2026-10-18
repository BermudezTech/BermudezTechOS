import { useEffect, type ReactNode } from 'react';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { useMotionEnabled } from '@/theme';

/** Aparición suave (opacidad + desplazamiento) en el hilo de UI; se omite con "reducir movimiento". */
export function FadeIn({ children, delay = 0, offset = 16 }: { children: ReactNode; delay?: number; offset?: number }) {
  const motion = useMotionEnabled();
  const progress = useSharedValue(motion ? 0 : 1);

  useEffect(() => {
    if (motion) progress.set(withDelay(delay, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) })));
  }, [motion, delay, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * offset }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}
