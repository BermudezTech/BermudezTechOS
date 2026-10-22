import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExpiredSessionBanner } from '@/components/sync/ExpiredSessionBanner';
import { useSession } from '@/session/hooks';
import { ensureLocalData } from '@/session/localData';
import { startSync, stopSync } from '@/sync';
import { useTheme } from '@/theme';

/**
 * Pantallas privadas: todo lo que se añada bajo `(app)/` exige sesión sin configuración extra
 * (FR-039). Aquí vive la sincronización: solo corre con sesión iniciada. Con la base vacía, el
 * primer ciclo es la descarga inicial (FR-025).
 */
export default function AppLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { expired } = useSession();

  useEffect(() => {
    let active = true;
    // Tras un inicio de sesión la base aún no está abierta; al arrancar con sesión ya lo está.
    ensureLocalData().then(() => active && startSync());
    return () => {
      active = false;
      stopSync();
    };
  }, []);

  // Misma estructura con y sin aviso, para no remontar el Stack (y perder la navegación) al vencer.
  // Con el aviso, este ocupa el área segura superior y las pantallas debajo no la reservan otra vez.
  return (
    <View style={{ flex: 1 }}>
      {expired ? <ExpiredSessionBanner /> : null}
      <SafeAreaInsetsContext.Provider value={expired ? { ...insets, top: 0 } : insets}>
        <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="reauth" options={{ presentation: 'modal' }} />
          </Stack>
        </View>
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}
