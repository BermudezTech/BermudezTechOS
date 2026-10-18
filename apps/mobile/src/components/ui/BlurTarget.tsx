import { BlurTargetView } from 'expo-blur';
import { createContext, useContext, useRef, type ComponentRef, type ReactNode, type RefObject } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * En Android, `BlurView` necesita una referencia al contenido que difumina
 * (`BlurTargetView`). Esta área envuelve el contenido de las pestañas para que la
 * barra de navegación pueda difuminarlo (research R7: blur limitado a superficies flotantes).
 */
type ViewRef = ComponentRef<typeof View>;

const BlurTargetContext = createContext<RefObject<ViewRef | null> | null>(null);

export function useBlurTarget(): RefObject<ViewRef | null> | null {
  return useContext(BlurTargetContext);
}

/** Crea la referencia compartida entre el contenido y las superficies flotantes. */
export function BlurTargetProvider({ children }: { children: ReactNode }) {
  const ref = useRef<ViewRef | null>(null);
  return <BlurTargetContext.Provider value={Platform.OS === 'android' ? ref : null}>{children}</BlurTargetContext.Provider>;
}

/** Contenido que las superficies `blur` pueden difuminar en Android. */
export function BlurTargetArea({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const ref = useBlurTarget();
  if (!ref) {
    return <View style={[styles.fill, style]}>{children}</View>;
  }
  return (
    <BlurTargetView ref={ref} style={[styles.fill, style]}>
      {children}
    </BlurTargetView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
