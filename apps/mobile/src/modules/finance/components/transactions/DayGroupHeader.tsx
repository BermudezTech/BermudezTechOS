import { View } from 'react-native';

import { Amount, AppText } from '@/components/ui';
import { formatRelativeDay } from '@/lib/dates';
import type { Cents } from '@/lib/money';
import { useTheme } from '@/theme';

export function DayGroupHeader({ day, net }: { day: string; net: Cents }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: theme.spacing(4),
        paddingBottom: theme.spacing(1.5),
        paddingHorizontal: 4,
      }}>
      <AppText variant="bodyStrong" tone="muted" accessibilityRole="header">
        {formatRelativeDay(day)}
      </AppText>
      {net !== 0 ? <Amount value={net} size="small" muted /> : null}
    </View>
  );
}
