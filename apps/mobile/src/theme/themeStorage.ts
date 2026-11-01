import * as SecureStore from 'expo-secure-store';

import type { ThemeMode } from './tokens';

/**
 * Tema elegido en el dispositivo (Android: `expo-secure-store`, sin dependencias nuevas). La lectura
 * es síncrona para aplicar el tema desde el primer render, sin parpadeo. Es una preferencia del
 * dispositivo: no se borra al cerrar sesión.
 */
const KEY = 'bt.themeMode';

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function loadThemeMode(): ThemeMode {
  try {
    const raw = SecureStore.getItem(KEY);
    return isThemeMode(raw) ? raw : 'system';
  } catch {
    return 'system';
  }
}

export function saveThemeMode(mode: ThemeMode): void {
  // Si falla la escritura, el tema sigue aplicado en esta sesión.
  SecureStore.setItemAsync(KEY, mode).catch(() => undefined);
}
