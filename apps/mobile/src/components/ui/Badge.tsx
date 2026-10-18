import { View } from 'react-native';

import { useTheme, type Theme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export type BadgeTone = 'neutral' | 'accent' | 'warning' | 'danger' | 'success' | 'info';

function toneColor(theme: Theme, tone: BadgeTone): string {
  switch (tone) {
    case 'accent':
      return theme.colors.accentText;
    case 'warning':
      return theme.colors.warning;
    case 'danger':
      return theme.colors.danger;
    case 'success':
      return theme.colors.success;
    case 'info':
      return theme.colors.transfer;
    default:
      return theme.colors.textMuted;
  }
}

export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: BadgeTone; icon?: IconName }) {
  const theme = useTheme();
  const color = toneColor(theme, tone);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: theme.radii.pill,
        backgroundColor: `${color}22`,
        borderWidth: 1,
        borderColor: `${color}55`,
      }}>
      {icon ? <Icon name={icon} size={12} color={color} /> : null}
      <AppText variant="caption" color={color} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}
