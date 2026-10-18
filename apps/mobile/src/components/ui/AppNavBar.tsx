import { usePathname } from 'expo-router';
import { TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { useState, type ComponentRef, type Ref } from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import logo from '@/assets/images/logo.png';
import { activeModules, appModules, comingSoonModules, type AppModule } from '@/modules/registry';
import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { GlassSurface } from './GlassSurface';
import { Icon } from './Icon';
import { isModalPath } from './layout';

export const BOTTOM_BAR_HEIGHT = 64;

type NavButtonProps = TabTriggerSlotProps & {
  module: AppModule;
  orientation: 'bottom' | 'side';
  ref?: Ref<ComponentRef<typeof Pressable>>;
};

function NavButton({ module, orientation, isFocused, ...props }: NavButtonProps) {
  const theme = useTheme();
  const color = isFocused ? theme.colors.accentText : theme.colors.textMuted;
  const side = orientation === 'side';
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityLabel={module.label}
      accessibilityState={{ selected: !!isFocused }}
      style={({ pressed }) => [
        side ? styles.sideItem : styles.bottomItem,
        {
          minHeight: theme.layout.minTouchTarget,
          borderRadius: theme.radii.md,
          backgroundColor: isFocused && side ? theme.colors.accentSoft : pressed ? theme.colors.surfacePressed : 'transparent',
        },
      ]}>
      <Icon
        name={isFocused ? (module.icon.replace('-outline', '') as typeof module.icon) : module.icon}
        size={side ? 20 : 22}
        color={color}
      />
      <AppText variant={side ? 'bodyStrong' : 'caption'} color={side && isFocused ? theme.colors.text : color} numberOfLines={1}>
        {module.label}
      </AppText>
    </Pressable>
  );
}

function ComingSoonItem({ module }: { module: AppModule }) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${module.label}, próximamente`}
      accessibilityState={{ disabled: true }}
      style={[styles.sideItem, { minHeight: theme.layout.minTouchTarget, opacity: 0.6 }]}>
      <Icon name={module.icon} size={20} color={theme.colors.textMuted} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="body" tone="muted" numberOfLines={1}>
          {module.label}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          Próximamente
        </AppText>
      </View>
    </View>
  );
}

function trigger(module: AppModule, orientation: 'bottom' | 'side') {
  return (
    <TabTrigger key={module.id} name={module.id} asChild resetOnFocus={module.id === 'finance'}>
      <NavButton module={module} orientation={orientation} />
    </TabTrigger>
  );
}

/** Barra lateral para pantallas anchas (≥ 1024 px). */
export function SideNav() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const main = appModules.filter((m) => m.placement === 'main');
  const footer = activeModules.filter((m) => m.placement === 'footer');
  return (
    <GlassSurface
      strong
      radius={theme.radii.xl}
      accessibilityRole="tablist"
      style={[styles.side, { width: theme.layout.sideNavWidth, marginTop: insets.top + 12, padding: theme.spacing(3) }]}>
      <View style={[styles.brand, { paddingHorizontal: theme.spacing(2) }]}>
        <Image source={logo} style={{ width: 36, height: 36 }} accessibilityIgnoresInvertColors accessible={false} />
        <AppText variant="heading" numberOfLines={1}>
          BermudezTechOS
        </AppText>
      </View>
      <View style={{ gap: 4, flex: 1 }}>
        {main.map((m) => (m.status === 'active' ? trigger(m, 'side') : <ComingSoonItem key={m.id} module={m} />))}
      </View>
      <View style={{ gap: 4 }}>{footer.map((m) => trigger(m, 'side'))}</View>
    </GlassSurface>
  );
}

/** Barra inferior flotante para teléfonos; "Más" muestra los módulos próximos. */
export function BottomNav() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = usePathname();
  // Los formularios (modales) ocupan toda la pantalla, sin la barra.
  if (isModalPath(pathname)) return null;
  return (
    <View
      style={[styles.bottomWrap, { paddingBottom: Math.max(insets.bottom, 10), paddingHorizontal: theme.spacing(3) }]}
      pointerEvents="box-none">
      <GlassSurface
        variant="blur"
        strong
        radius={theme.radii.pill}
        accessibilityRole="tablist"
        style={[styles.bottom, { height: BOTTOM_BAR_HEIGHT }]}>
        {activeModules.map((m) => trigger(m, 'bottom'))}
        <Pressable
          onPress={() => setMoreOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Más módulos"
          style={({ pressed }) => [
            styles.bottomItem,
            {
              minHeight: theme.layout.minTouchTarget,
              borderRadius: theme.radii.md,
              backgroundColor: pressed ? theme.colors.surfacePressed : 'transparent',
            },
          ]}>
          <Icon name="grid-outline" size={22} color={theme.colors.textMuted} />
          <AppText variant="caption" tone="muted">
            Más
          </AppText>
        </Pressable>
      </GlassSurface>

      <Modal visible={moreOpen} transparent animationType="fade" onRequestClose={() => setMoreOpen(false)}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]}
          onPress={() => setMoreOpen(false)}
          accessibilityLabel="Cerrar">
          <GlassSurface
            strong
            radius={theme.radii.xl}
            style={[styles.sheet, { marginBottom: insets.bottom + 12, padding: theme.spacing(4) }]}>
            <AppText variant="heading">Más módulos</AppText>
            <AppText variant="caption" tone="muted">
              Estos módulos llegarán en próximas versiones.
            </AppText>
            <View style={{ gap: 4, marginTop: theme.spacing(2) }}>
              {comingSoonModules.map((m) => (
                <ComingSoonItem key={m.id} module={m} />
              ))}
            </View>
          </GlassSurface>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  side: { margin: 12, gap: 16, alignSelf: 'stretch' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  sideItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12 },
  bottomWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: 520,
    paddingHorizontal: 8,
  },
  bottomItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  backdrop: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 12 },
  sheet: { width: '100%', maxWidth: 520, gap: 4 },
});
