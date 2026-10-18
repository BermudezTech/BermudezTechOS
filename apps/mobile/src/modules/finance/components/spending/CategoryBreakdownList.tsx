import { router } from 'expo-router';
import { View } from 'react-native';

import { Amount, AppText, IconBadge, ListItem, type IconName } from '@/components/ui';
import { formatPercent } from '@/lib/money';
import type { Period } from '@/lib/dates';
import { useTheme } from '@/theme';

import type { SpendingItem } from '../../domain/spending';
import { categoryColor } from './CategoryDonut';
import { DeltaText } from './DeltaText';

export function CategoryBreakdownList({ items, period }: { items: SpendingItem[]; period: Period }) {
  const theme = useTheme();
  return (
    <View>
      {items.map((item, i) => {
        const color = categoryColor(item, i, theme.colors.categoryPalette);
        return (
          <ListItem
            key={item.categoryId ?? 'none'}
            title={item.name}
            left={<IconBadge name={(item.icon as IconName | null) ?? 'help-circle-outline'} color={color} />}
            meta={<DeltaText delta={item.delta} suffix="" />}
            right={
              <View style={{ alignItems: 'flex-end' }}>
                <Amount value={item.amount} />
                <AppText variant="caption" tone="muted">
                  {formatPercent(item.pct)}
                </AppText>
              </View>
            }
            chevron
            onPress={() =>
              router.push(`/finance/spending/${item.categoryId ?? 'none'}?granularity=${period.granularity}&anchor=${period.anchor}`)
            }
          />
        );
      })}
    </View>
  );
}
