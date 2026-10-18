import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { useNavInset } from './layout';
import { ScreenBackground } from './ScreenBackground';

type Props = {
  title?: string;
  subtitle?: string;
  /** Muestra el botón atrás; `fallback` se usa si no hay historial (p. ej. recarga en web). */
  back?: boolean;
  fallback?: Href;
  /** Acciones a la derecha del título. */
  right?: ReactNode;
  /** false si el hijo gestiona su propio scroll (listas virtualizadas). */
  scroll?: boolean;
  /** Pantallas presentadas como modal: sin espacio para la barra inferior. */
  modal?: boolean;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

/** Espaciado inferior que deben respetar las listas propias (scroll={false}). */
export function useScreenBottomPadding(modal = false): number {
  const insets = useSafeAreaInsets();
  const navInset = useNavInset();
  return (modal ? insets.bottom : Math.max(navInset, insets.bottom)) + 96;
}

/**
 * Vuelve a la pantalla anterior del stack actual; si no hay (enlace directo o recarga en
 * web), navega a `fallback` en lugar de salir de la sección.
 */
export function goBack(fallback: Href = '/finance') {
  if (router.canDismiss()) router.dismiss();
  else router.replace(fallback);
}

export function Screen({ title, subtitle, back, fallback, right, scroll = true, modal, children, contentStyle }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPadding = useScreenBottomPadding(modal);
  const side = theme.spacing(4);

  const header =
    title || back || right ? (
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing(3), paddingHorizontal: side }]}>
        <View style={styles.headerInner}>
          {back ? (
            <Pressable
              onPress={() => goBack(fallback)}
              accessibilityRole="button"
              accessibilityLabel="Atrás"
              hitSlop={8}
              style={({ pressed }) => [
                styles.backButton,
                {
                  borderRadius: theme.radii.pill,
                  backgroundColor: pressed ? theme.colors.surfacePressed : theme.colors.surface,
                  borderColor: theme.colors.border,
                  width: theme.layout.minTouchTarget,
                  height: theme.layout.minTouchTarget,
                },
              ]}>
              <Icon name="chevron-back" size={22} />
            </Pressable>
          ) : null}
          <View style={styles.titleBox}>
            {title ? (
              <AppText variant={back ? 'heading' : 'title'} numberOfLines={1} accessibilityRole="header">
                {title}
              </AppText>
            ) : null}
            {subtitle ? (
              <AppText variant="caption" tone="muted" numberOfLines={1}>
                {subtitle}
              </AppText>
            ) : null}
          </View>
          {right ? <View style={styles.right}>{right}</View> : null}
        </View>
      </View>
    ) : (
      <View style={{ height: insets.top }} />
    );

  const inner = [styles.content, { maxWidth: theme.layout.maxContentWidth, paddingHorizontal: side, gap: theme.spacing(4) }, contentStyle];

  return (
    <View style={styles.root}>
      <ScreenBackground />
      {header}
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding, paddingTop: theme.spacing(2) }]}
          keyboardShouldPersistTaps="handled">
          <View style={inner}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[styles.fill, { paddingTop: theme.spacing(2) }]}>
          <View style={[inner, styles.fill]}>{children}</View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  header: { width: '100%', alignItems: 'center' },
  headerInner: { width: '100%', maxWidth: 1200, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  backButton: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  titleBox: { flex: 1, minWidth: 0 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scrollContent: { flexGrow: 1, alignItems: 'center' },
  content: { width: '100%', alignSelf: 'center' },
});
