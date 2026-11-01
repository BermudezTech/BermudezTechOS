import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { loadThemeMode, saveThemeMode } from './themeStorage';
import { themes, type Theme, type ThemeMode } from './tokens';

type ThemeContextValue = {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  reducedMotion: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // La preferencia se guarda en el dispositivo y se lee al montar, antes del primer render.
  const [mode, setModeState] = useState<ThemeMode>(loadThemeMode);
  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    saveThemeMode(next);
  }, []);
  const system = useColorScheme();
  const reducedMotion = useReducedMotion();
  const scheme = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;

  const value = useMemo(() => ({ theme: themes[scheme], mode, setMode, reducedMotion }), [scheme, mode, setMode, reducedMotion]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de ThemeProvider');
  return ctx;
}

export function useTheme(): Theme {
  return useThemeContext().theme;
}

export function useThemeMode(): Pick<ThemeContextValue, 'mode' | 'setMode'> {
  const { mode, setMode } = useThemeContext();
  return { mode, setMode };
}

export function useMotionEnabled(): boolean {
  return !useThemeContext().reducedMotion;
}
