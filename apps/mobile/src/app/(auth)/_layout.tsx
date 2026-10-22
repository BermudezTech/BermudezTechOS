import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

/** Pantallas públicas: solo accesibles sin sesión (contracts/navigation.md). */
export default function AuthLayout() {
  const theme = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }} />;
}
