import { router } from 'expo-router';
import { View } from 'react-native';

import { Amount, AppText, Badge, GlassCard, ListItem, type IconName } from '@/components/ui';
import { useTheme } from '@/theme';

import type { NetWorthEntry, NetWorthGroup } from '../../domain/netWorth';

function routeFor(entry: NetWorthEntry): string {
  if (entry.kind === 'account') return `/finance/accounts/${entry.id}`;
  if (entry.kind === 'cdt') return `/finance/investments/${entry.id}`;
  return `/finance/net-worth/assets/${entry.id}/edit`;
}

export function NetWorthBreakdown({ groups }: { groups: NetWorthGroup[] }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing(3) }}>
      {groups.map((group) => (
        <GlassCard key={group.key} padded={false} style={{ padding: theme.spacing(2) }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 8,
              paddingVertical: 6,
            }}>
            <AppText variant="bodyStrong" tone="muted">
              {group.label}
            </AppText>
            <Amount value={group.total} variant={group.key === 'LIABILITIES' ? 'debt' : 'auto'} />
          </View>
          {group.items.map((item) => (
            <ListItem
              key={item.id}
              title={item.name}
              icon={(item.icon as IconName | null) ?? 'ellipse-outline'}
              iconColor={item.color ?? undefined}
              muted={item.excluded}
              meta={
                item.excluded || item.expired ? (
                  <>
                    {item.excluded ? <Badge label="Excluida" /> : null}
                    {item.expired ? <Badge label="Actualiza su valor" tone="warning" icon="alert-circle-outline" /> : null}
                  </>
                ) : undefined
              }
              right={<Amount value={item.value} variant={group.key === 'LIABILITIES' ? 'debt' : 'auto'} muted={item.excluded} />}
              chevron
              onPress={() => router.push(routeFor(item))}
            />
          ))}
        </GlassCard>
      ))}
    </View>
  );
}
