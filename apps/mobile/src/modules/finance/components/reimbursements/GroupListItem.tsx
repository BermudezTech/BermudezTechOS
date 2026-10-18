import { router } from 'expo-router';
import { memo } from 'react';
import { View } from 'react-native';

import { Amount, AppText, Badge, ListItem, type BadgeTone } from '@/components/ui';
import { abs } from '@/lib/money';

import type { GroupWithBalance } from '../../domain/reimbursements';
import type { GroupStatus } from '../../domain/types';

export const groupStatusMeta: Record<GroupStatus, { label: string; tone: BadgeTone }> = {
  OPEN: { label: 'Abierto', tone: 'info' },
  SUBMITTED: { label: 'Enviado', tone: 'accent' },
  SETTLED: { label: 'Saldado', tone: 'success' },
};

function GroupListItemBase({ item }: { item: GroupWithBalance }) {
  const { group, balance, label } = item;
  const tone = balance < 0 ? 'expense' : balance > 0 ? 'transfer' : 'muted';
  return (
    <ListItem
      title={group.name}
      subtitle={[group.kind === 'ADVANCE' ? 'Adelanto' : 'Reembolso', group.payer].filter(Boolean).join(' · ')}
      icon={group.kind === 'ADVANCE' ? 'cash-outline' : 'receipt-outline'}
      muted={group.status === 'SETTLED'}
      meta={<Badge label={groupStatusMeta[group.status].label} tone={groupStatusMeta[group.status].tone} />}
      right={
        <View style={{ alignItems: 'flex-end' }}>
          <Amount value={abs(balance)} variant={balance < 0 ? 'debt' : balance > 0 ? 'transfer' : 'default'} muted={balance === 0} />
          <AppText variant="caption" tone={tone}>
            {label}
          </AppText>
        </View>
      }
      chevron
      onPress={() => router.push(`/finance/reimbursements/${group.id}`)}
    />
  );
}

export const GroupListItem = memo(GroupListItemBase);
