import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

/**
 * Ruta privada pedida al arrancar sin sesión (research R11): `Stack.Protected` no la conserva,
 * así que se recuerda aquí, solo en memoria, para llevar al usuario a ella tras iniciar sesión.
 */
export const PUBLIC_ROUTES = ['/login', '/forgot-password', '/verify-code', '/reset-password'];

let pending: string | null = null;

export function rememberRoute(route: string | null): void {
  if (!route) return;
  const path = route.split('?')[0]!;
  if (path === '/' || path === '' || PUBLIC_ROUTES.includes(path)) return;
  pending = route;
}

export async function captureInitialRoute(): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') rememberRoute(window.location.pathname + window.location.search);
    return;
  }
  const url = await Linking.getInitialURL();
  if (!url) return;
  const { path, queryParams } = Linking.parse(url);
  if (!path) return;
  const query = new URLSearchParams(
    Object.entries(queryParams ?? {}).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : [])),
  ).toString();
  rememberRoute(`/${path.replace(/^\/+/, '')}${query ? `?${query}` : ''}`);
}

export function takePendingRoute(): string | null {
  const route = pending;
  pending = null;
  return route;
}
