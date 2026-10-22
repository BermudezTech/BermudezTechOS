import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EmptyState, GlassCard, IconButton, ListItem, Screen, SectionHeader, useIsWide } from '@/components/ui';
import { useAmountVisibilityStore } from '@/modules/finance/hooks/useAmountVisibility';
import { financeSections } from '@/modules/finance/sections';
import { useTheme } from '@/theme';

/** Finanzas → Resumen: tarjetas de resumen + accesos a cada sección (research R13). */
export default function FinanceHomeScreen() {
  const theme = useTheme();
  const wide = useIsWide();
  const allVisible = useAmountVisibilityStore((s) => s.allVisible);
  const setAll = useAmountVisibilityStore((s) => s.setAll);
  const cards = financeSections.flatMap((s) => s.summaryCards ?? []).sort((a, b) => a.order - b.order);

  return (
    <Screen
      title="Finanzas"
      subtitle="Tu dinero, al día"
      right={
        <IconButton
          icon={allVisible ? 'eye-off-outline' : 'eye-outline'}
          accessibilityLabel={allVisible ? 'Ocultar todos los valores' : 'Mostrar todos los valores'}
          onPress={() => setAll(!allVisible)}
        />
      }>
      {financeSections.length === 0 ? (
        <EmptyState icon="wallet-outline" title="Aún no hay secciones" message="Las secciones de finanzas aparecerán aquí." />
      ) : null}

      {cards.length > 0 ? (
        <View style={[styles.grid, { gap: theme.spacing(3) }]}>
          {cards.map(({ id, Card, order }) => (
            <View key={id} style={wide && order < 10 ? styles.half : styles.full}>
              <Card />
            </View>
          ))}
        </View>
      ) : null}

      {financeSections.length > 0 ? (
        <>
          <SectionHeader title="Secciones" />
          <GlassCard padded={false} style={{ padding: theme.spacing(2) }}>
            {financeSections.map((section) => (
              <ListItem
                key={section.id}
                title={section.label}
                subtitle={section.description}
                icon={section.icon}
                chevron
                onPress={() => router.push(section.route)}
              />
            ))}
          </GlassCard>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  full: { width: '100%' },
  half: { flexBasis: '48%', flexGrow: 1 },
});
