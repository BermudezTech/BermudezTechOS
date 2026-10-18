import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from './AppText';

type Props = { title: string; actionLabel?: string; onAction?: () => void; right?: React.ReactNode };

export function SectionHeader({ title, actionLabel, onAction, right }: Props) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: theme.spacing(1) }}>
      <AppText variant="heading" accessibilityRole="header" style={{ flex: 1 }} numberOfLines={1}>
        {title}
      </AppText>
      {right}
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          hitSlop={10}
          style={{ minHeight: theme.layout.minTouchTarget, justifyContent: 'center' }}>
          <AppText variant="bodyStrong" tone="accent">
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
