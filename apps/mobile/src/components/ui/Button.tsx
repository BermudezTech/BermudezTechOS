import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  disabled?: boolean;
  compact?: boolean;
  accessibilityLabel?: string;
};

export function Button({ label, onPress, variant = 'primary', icon, disabled, compact, accessibilityLabel }: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const background =
    variant === 'primary' ? c.accent : variant === 'danger' ? `${c.danger}22` : variant === 'secondary' ? c.surface : 'transparent';
  const foreground = variant === 'primary' ? c.textOnAccent : variant === 'danger' ? c.danger : variant === 'ghost' ? c.accentText : c.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => ({
        minHeight: theme.layout.minTouchTarget,
        paddingHorizontal: compact ? theme.spacing(3) : theme.spacing(5),
        borderRadius: theme.radii.pill,
        backgroundColor: background,
        borderWidth: variant === 'secondary' ? 1 : 0,
        borderColor: c.border,
        opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {icon ? <Icon name={icon} size={18} color={foreground} /> : null}
        <AppText variant="bodyStrong" color={foreground} numberOfLines={1}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

/** Botón redondo solo con ícono (acciones de encabezado). */
export function IconButton({ icon, onPress, accessibilityLabel }: { icon: IconName; onPress: () => void; accessibilityLabel: string }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={({ pressed }) => ({
        width: theme.layout.minTouchTarget,
        height: theme.layout.minTouchTarget,
        borderRadius: theme.radii.pill,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: pressed ? theme.colors.surfacePressed : theme.colors.surface,
      })}>
      <Icon name={icon} size={20} />
    </Pressable>
  );
}
