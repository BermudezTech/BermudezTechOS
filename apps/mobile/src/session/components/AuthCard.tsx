import type { ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import logo from '@/assets/images/logo.png';
import { AppText, GlassCard } from '@/components/ui';
import { useTheme } from '@/theme';

/** Marco común de las pantallas públicas: logo, título y tarjeta de cristal centrada. */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.wrap, { gap: theme.spacing(5) }]}>
      <View style={[styles.brand, { gap: theme.spacing(2) }]}>
        <Image source={logo} style={styles.logo} accessibilityIgnoresInvertColors accessible={false} />
        <AppText variant="title" align="center" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText tone="muted" align="center">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <GlassCard>{children}</GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 420, alignSelf: 'center', paddingVertical: 32 },
  brand: { alignItems: 'center' },
  logo: { width: 72, height: 72 },
});
