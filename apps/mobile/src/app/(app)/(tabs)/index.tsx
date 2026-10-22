import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText, FadeIn, GlassCard, Screen } from '@/components/ui';
import { greetingFor } from '@/lib/greeting';
import { useDisplayName } from '@/session/hooks';
import { useInitialSync } from '@/sync/hooks';
import { useTheme } from '@/theme';

/** Inicio: en esta fase solo muestra un saludo, sin widgets ni datos (FR-007, FR-008). */
export default function HomeScreen() {
  const theme = useTheme();
  const displayName = useDisplayName();
  const initialSync = useInitialSync();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.center}>
        <FadeIn>
          <AppText variant="display" accessibilityRole="header">
            {greetingFor(now)},
          </AppText>
          <AppText variant="display" tone="accent">
            {displayName}
          </AppText>
        </FadeIn>
      </View>
      {initialSync.downloading ? (
        <GlassCard>
          <View style={[styles.row, { gap: theme.spacing(3) }]} accessibilityLiveRegion="polite">
            {initialSync.failed ? null : <ActivityIndicator color={theme.colors.accent} />}
            <AppText tone="muted" style={styles.flex}>
              {initialSync.failed ? 'La descarga no terminó; se reintentará automáticamente.' : 'Descargando tus datos…'}
            </AppText>
          </View>
        </GlassCard>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', paddingVertical: 48 },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
