import type { Href } from 'expo-router';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Amount, AppText, GlassCard, Icon, IconBadge, type IconName } from '@/components/ui';
import type { Cents } from '@/lib/money';
import { useTheme } from '@/theme';

import { useAmountVisibilityStore, useAmountVisible } from '../../hooks/useAmountVisibility';

type Props = {
  /** Clave para recordar si el valor está visible. */
  id: string;
  label: string;
  icon: IconName;
  /** Hexadecimal (#RRGGBB), como pide `IconBadge`. */
  iconColor?: string;
  value: Cents;
  variant?: 'auto' | 'default';
  href: Href;
  /** Línea extra bajo el monto (p. ej. variación); se oculta junto con el valor. */
  footer?: ReactNode;
};

const MASK = '$ ******';

/** Tarjeta de estadística del hub. El valor arranca oculto y se muestra con su ojo o con el del encabezado (todas a la vez). */
export function StatCard({ id, label, icon, iconColor, value, variant = 'default', href, footer }: Props) {
  const theme = useTheme();
  const visible = useAmountVisible(id);
  const toggle = useAmountVisibilityStore((s) => s.toggle);
  return (
    <GlassCard>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3) }}>
        <Pressable
          onPress={() => router.push(href)}
          accessibilityRole="button"
          accessibilityLabel={`${label}, ver detalle`}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing(3),
            opacity: pressed ? 0.85 : 1,
          })}>
          <IconBadge name={icon} color={iconColor} />
          <View style={{ flex: 1 }}>
            <AppText variant="caption" tone="muted">
              {label}
            </AppText>
            {visible ? (
              <Amount value={value} variant={variant} size="large" />
            ) : (
              <AppText variant="amountLarge" accessibilityLabel={`${label} oculto`}>
                {MASK}
              </AppText>
            )}
            {visible ? footer : null}
          </View>
        </Pressable>
        <Pressable
          onPress={() => toggle(id)}
          accessibilityRole="button"
          accessibilityLabel={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
          hitSlop={8}
          style={({ pressed }) => ({
            width: theme.layout.minTouchTarget,
            height: theme.layout.minTouchTarget,
            borderRadius: theme.radii.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: pressed ? theme.colors.surfacePressed : 'transparent',
          })}>
          <Icon name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color={theme.colors.textMuted} />
        </Pressable>
      </View>
    </GlassCard>
  );
}
