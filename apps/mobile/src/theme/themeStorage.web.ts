import type { ThemeMode } from './tokens';

/** Tema elegido en el navegador (`localStorage`); misma API que `themeStorage.ts`. */
const KEY = 'bt.themeMode';

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function loadThemeMode(): ThemeMode {
  try {
    const raw = window.localStorage.getItem(KEY);
    return isThemeMode(raw) ? raw : 'system';
  } catch {
    // Modo privado o almacenamiento bloqueado: se usa el tema del sistema.
    return 'system';
  }
}

export function saveThemeMode(mode: ThemeMode): void {
  try {
    window.localStorage.setItem(KEY, mode);
  } catch {
    // Sin almacenamiento el tema sigue aplicado en esta sesión.
  }
}
