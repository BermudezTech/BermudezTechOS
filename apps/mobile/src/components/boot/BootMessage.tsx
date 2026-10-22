import { StyleSheet, View } from 'react-native';

import { AppText, Button, GlassCard, IconBadge, ScreenBackground, type IconName } from '@/components/ui';
import { useTheme } from '@/theme';

/** Pantalla de arranque que impide entrar a la app (otra pestaña, almacenamiento bloqueado). */
export function BootMessage({ icon, message, onRetry }: { icon: IconName; message: string; onRetry: () => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background, padding: theme.spacing(4) }]}>
      <ScreenBackground />
      <GlassCard style={styles.card}>
        <View style={{ gap: theme.spacing(4), alignItems: 'center' }}>
          <IconBadge name={icon} size={56} />
          <AppText align="center" accessibilityRole="alert">
            {message}
          </AppText>
          <Button label="Reintentar" icon="refresh" onPress={onRetry} />
        </View>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { width: '100%', maxWidth: 420 },
});
