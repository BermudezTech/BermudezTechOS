import { router } from 'expo-router';

import { Amount, EmptyState, GlassCard, ListItem } from '@/components/ui';
import { useTheme } from '@/theme';

import type { AccountWithBalance } from '../../domain/accounts';
import { accountIcon } from './accountMeta';

export function PocketList({ pockets, parentId }: { pockets: AccountWithBalance[]; parentId: string }) {
  const theme = useTheme();
  if (pockets.length === 0) {
    return (
      <EmptyState
        icon="file-tray-outline"
        title="Sin cajitas"
        message="Aparta dinero para tus objetivos sin sacarlo de la cuenta."
        actionLabel="Crear cajita"
        onAction={() => router.push(`/finance/accounts/new?parentId=${parentId}`)}
      />
    );
  }
  return (
    <GlassCard padded={false} style={{ padding: theme.spacing(2) }}>
      {pockets.map((p) => (
        <ListItem
          key={p.account.id}
          title={p.account.name}
          subtitle="Cajita"
          icon={accountIcon(p.account)}
          iconColor={p.account.color ?? undefined}
          right={<Amount value={p.ownBalance} />}
          chevron
          onPress={() => router.push(`/finance/accounts/${p.account.id}`)}
        />
      ))}
    </GlassCard>
  );
}
