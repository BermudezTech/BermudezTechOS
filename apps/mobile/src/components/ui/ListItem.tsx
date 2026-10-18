import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, IconBadge, type IconName } from './Icon';

type Props = {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconColor?: string;
  left?: ReactNode;
  right?: ReactNode;
  /** Contenido extra bajo el subtítulo (p. ej. badges). */
  meta?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  muted?: boolean;
  accessibilityLabel?: string;
};

function ListItemBase({ title, subtitle, icon, iconColor, left, right, meta, onPress, chevron, muted, accessibilityLabel }: Props) {
  const theme = useTheme();
  const content = (
    <View style={[styles.row, { minHeight: theme.layout.minTouchTarget + 8, opacity: muted ? 0.55 : 1 }]}>
      {left ?? (icon ? <IconBadge name={icon} color={iconColor} /> : null)}
      <View style={styles.texts}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
        {meta ? <View style={styles.meta}>{meta}</View> : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
      {chevron ? <Icon name="chevron-forward" size={18} color={theme.colors.textMuted} /> : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)}
      style={({ pressed }) => ({
        borderRadius: theme.radii.md,
        backgroundColor: pressed ? theme.colors.surfacePressed : 'transparent',
      })}>
      {content}
    </Pressable>
  );
}

export const ListItem = memo(ListItemBase);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6, paddingHorizontal: 4 },
  texts: { flex: 1, minWidth: 0, gap: 2 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  right: { alignItems: 'flex-end', flexShrink: 0, maxWidth: '50%' },
});
