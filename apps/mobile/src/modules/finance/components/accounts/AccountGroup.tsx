import { View } from 'react-native';

import { Amount, AppText, GlassCard } from '@/components/ui';
import { useTheme } from '@/theme';

import type { AccountGroup as Group } from '../../domain/accounts';
import { AccountListItem } from './AccountListItem';

export function AccountGroup({ group }: { group: Group }) {
  const theme = useTheme();
  return (
    <GlassCard padded={false} style={{ padding: theme.spacing(2) }}>
      <View
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 6 }}>
        <AppText variant="bodyStrong" tone="muted">
          {group.label}
        </AppText>
        <Amount value={group.total} variant={group.key === 'CARDS' ? 'debt' : 'auto'} />
      </View>
      {group.items.map((item) => (
        <AccountListItem key={item.account.id} item={item} />
      ))}
    </GlassCard>
  );
}
