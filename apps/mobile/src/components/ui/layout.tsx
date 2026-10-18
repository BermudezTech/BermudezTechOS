import { createContext, useContext } from 'react';
import { useWindowDimensions } from 'react-native';

import { useTheme } from '@/theme';

/** true si el ancho permite la barra lateral (≥ 1024 px, FR-003). */
export function useIsWide(): boolean {
  const { width } = useWindowDimensions();
  return width >= useTheme().layout.wideBreakpoint;
}

/** Espacio inferior que ocupa la barra de navegación flotante (0 con barra lateral). */
export const NavInsetContext = createContext(0);

export function useNavInset(): number {
  return useContext(NavInsetContext);
}

/** Rutas presentadas como modal (formularios de creación/edición). */
export function isModalPath(pathname: string): boolean {
  return /\/(new|edit)$/.test(pathname);
}
