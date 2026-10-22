import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BootMessage } from '@/components/boot/BootMessage';
import { acquireTabLock } from '@/db/webTabLock';
import { useSession } from '@/session/hooks';
import { ensureLocalData } from '@/session/localData';
import { captureInitialRoute } from '@/session/pendingRoute';
import { restoreSession } from '@/session/sessionService';
import { useSessionStore } from '@/session/sessionStore';
import { StorageUnavailableError } from '@/session/storageErrors';
import { ThemeProvider, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

type BootState = 'pending' | 'ready' | 'storageUnavailable' | 'otherTab';

function Navigation() {
  const theme = useTheme();
  const { status } = useSession();
  const signedIn = status === 'signedIn';
  const navigationTheme = useMemo(() => {
    const base = theme.scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: theme.colors.background,
        card: theme.colors.background,
        text: theme.colors.text,
        primary: theme.colors.accent,
        border: theme.colors.border,
      },
    };
  }, [theme]);

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      {/* Guarda de rutas en un único punto (FR-035–FR-039, research R11). */}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}>
        <Stack.Protected guard={signedIn} redirectTo="/login">
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Screen name="+not-found" />
      </Stack>
    </NavigationThemeProvider>
  );
}

/**
 * Arranque: ruta pedida → candado de pestaña (web) → sesión guardada (sin red) → base local e
 * hidratación del espejo. Hasta terminar, el splash sigue visible (FR-038).
 */
async function boot(): Promise<BootState> {
  await captureInitialRoute();
  if (!(await acquireTabLock())) return 'otherTab';
  try {
    await restoreSession();
  } catch (error) {
    if (error instanceof StorageUnavailableError) return 'storageUnavailable';
    throw error;
  }
  if (useSessionStore.getState().status === 'signedIn') await ensureLocalData();
  return 'ready';
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const [bootState, setBootState] = useState<BootState>('pending');
  const [attempt, setAttempt] = useState(0);
  const fontsReady = fontsLoaded || !!fontError;

  useEffect(() => {
    let alive = true;
    boot().then((state) => alive && setBootState(state));
    return () => {
      alive = false;
    };
  }, [attempt]);

  const retryBoot = useCallback(() => {
    setBootState('pending');
    setAttempt((n) => n + 1);
  }, []);

  const ready = fontsReady && bootState !== 'pending';

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          {bootState === 'otherTab' ? (
            <BootMessage icon="copy-outline" message="BermudezTechOS ya está abierto en otra pestaña." onRetry={retryBoot} />
          ) : bootState === 'storageUnavailable' ? (
            <BootMessage
              icon="lock-closed-outline"
              message="Este navegador no permite guardar datos (¿modo privado?). Abre la app en una ventana normal para usarla."
              onRetry={retryBoot}
            />
          ) : (
            <Navigation />
          )}
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
