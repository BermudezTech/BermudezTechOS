import { Text, type TextProps } from 'react-native';

import { useTheme, type Theme } from '@/theme';

export type TextVariant = keyof Theme['typography'];
export type TextTone = 'default' | 'muted' | 'accent' | 'income' | 'expense' | 'transfer' | 'warning' | 'danger' | 'onAccent';

type Props = TextProps & { variant?: TextVariant; tone?: TextTone; color?: string; align?: 'left' | 'center' | 'right' };

export function toneColor(theme: Theme, tone: TextTone): string {
  const c = theme.colors;
  switch (tone) {
    case 'muted':
      return c.textMuted;
    case 'accent':
      return c.accentText;
    case 'income':
      return c.income;
    case 'expense':
      return c.expense;
    case 'transfer':
      return c.transfer;
    case 'warning':
      return c.warning;
    case 'danger':
      return c.danger;
    case 'onAccent':
      return c.textOnAccent;
    default:
      return c.text;
  }
}

export function AppText({ variant = 'body', tone = 'default', color, align, style, ...rest }: Props) {
  const theme = useTheme();
  return <Text {...rest} style={[theme.typography[variant], { color: color ?? toneColor(theme, tone), textAlign: align }, style]} />;
}
