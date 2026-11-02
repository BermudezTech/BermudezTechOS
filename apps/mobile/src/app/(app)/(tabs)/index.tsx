import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText, Fab, FadeIn, GlassCard, IconButton, Screen, useIsWide } from '@/components/ui';
import { greetingFor } from '@/lib/greeting';
import { dashboardWidgets } from '@/modules/dashboard';
import { QuickActionSheet } from '@/modules/finance/components/home/QuickActionSheet';
import { useAmountVisibilityStore } from '@/modules/finance/hooks/useAmountVisibility';
import { useDisplayName } from '@/session/hooks';
import { useInitialSync } from '@/sync/hooks';
import { useTheme } from '@/theme';

/**
 * Inicio: saludo compacto y tablero de widgets que aportan los módulos activos (spec 010,
 * contracts/widgets.md). La pantalla no conoce cada widget: los toma de `dashboardWidgets`.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const wide = useIsWide();
  const displayName = useDisplayName();
  const initialSync = useInitialSync();
  const allVisible = useAmountVisibilityStore((s) => s.allVisible);
  const setAll = useAmountVisibilityStore((s) => s.setAll);
  const [now, setNow] = useState(() => new Date());
  const [quickOpen, setQuickOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={styles.flex}>
      <Screen>
        <View style={[styles.row, { gap: theme.spacing(3), paddingTop: theme.spacing(2) }]}>
          <View style={styles.flex}>
            <FadeIn>
              <AppText variant="title" accessibilityRole="header">
                {greetingFor(now)},{' '}
                <AppText variant="title" tone="accent">
                  {displayName}
                </AppText>
              </AppText>
            </FadeIn>
          </View>
          <IconButton
            icon={allVisible ? 'eye-off-outline' : 'eye-outline'}
            accessibilityLabel={allVisible ? 'Ocultar todos los valores' : 'Mostrar todos los valores'}
            onPress={() => setAll(!allVisible)}
          />
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

        <View style={[styles.grid, { gap: theme.spacing(3) }]}>
          {dashboardWidgets.map(({ id, span, Widget }) => (
            <View key={id} style={wide && span === 'half' ? styles.half : styles.full}>
              <Widget />
            </View>
          ))}
        </View>
      </Screen>
      <Fab accessibilityLabel="Registrar movimiento" onPress={() => setQuickOpen(true)} />
      <QuickActionSheet visible={quickOpen} onClose={() => setQuickOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  full: { width: '100%' },
  half: { flexBasis: '48%', flexGrow: 1 },
});
