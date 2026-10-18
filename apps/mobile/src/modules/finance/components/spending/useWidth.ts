import { useCallback, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

/** Ancho medido de un contenedor (para dimensionar gráficas). */
export function useWidth(initial = 300) {
  const [width, setWidth] = useState(initial);
  const onLayout = useCallback((e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width)), []);
  return { width, onLayout };
}
