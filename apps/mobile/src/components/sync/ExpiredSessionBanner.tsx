import { router } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, GlassSurface, Icon } from '@/components/ui';
import { useTheme } from '@/theme';

/** Aviso no bloqueante de sesión vencida (FR-031, navegación N5): la app sigue usable. */
export function ExpiredSessionBanner() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{ paddingTop: insets.top + theme.spacing(2), paddingHorizontal: theme.spacing(4), backgroundColor: theme.colors.background }}>
      <GlassSurface style={{ padding: theme.spacing(3) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3) }} accessibilityRole="alert">
          <Icon name="cloud-offline-outline" size={20} color={theme.colors.warning} />
          <AppText style={{ flex: 1 }}>Tu sesión venció. Inicia sesión para sincronizar.</AppText>
          <Button label="Iniciar sesión" compact variant="ghost" onPress={() => router.push('/reauth')} />
        </View>
      </GlassSurface>
    </View>
  );
}
