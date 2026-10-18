import { router } from 'expo-router';
import { View } from 'react-native';

import { EmptyState, GlassCard, IconButton, Screen, SectionHeader } from '@/components/ui';
import { GroupListItem } from '@/modules/finance/components/reimbursements/GroupListItem';
import { GroupsSummaryHeader } from '@/modules/finance/components/reimbursements/GroupsSummaryHeader';
import { useReimbursementGroups } from '@/modules/finance/hooks/useReimbursements';
import { useTheme } from '@/theme';

export default function ReimbursementsScreen() {
  const theme = useTheme();
  const { open, closed, totalOwedToMe, totalHeldForOthers } = useReimbursementGroups();
  const empty = open.length === 0 && closed.length === 0;
  return (
    <Screen
      title="Reembolsos"
      subtitle="Viáticos, adelantos y dinero de terceros"
      back
      right={<IconButton icon="add" accessibilityLabel="Nuevo grupo" onPress={() => router.push('/finance/reimbursements/new')} />}>
      {empty ? (
        <EmptyState
          icon="briefcase-outline"
          title="Sin grupos de reembolso"
          message="Agrupa los gastos de un viaje o los adelantos de tu empresa para que no se mezclen con tus finanzas."
          actionLabel="Nuevo grupo"
          onAction={() => router.push('/finance/reimbursements/new')}
        />
      ) : (
        <>
          <GroupsSummaryHeader owedToMe={totalOwedToMe} heldForOthers={totalHeldForOthers} />
          {open.length > 0 ? (
            <View style={{ gap: theme.spacing(3) }}>
              <SectionHeader title="Abiertos" />
              <GlassCard padded={false} style={{ padding: theme.spacing(2) }}>
                {open.map((item) => (
                  <GroupListItem key={item.group.id} item={item} />
                ))}
              </GlassCard>
            </View>
          ) : null}
          {closed.length > 0 ? (
            <View style={{ gap: theme.spacing(3) }}>
              <SectionHeader title="Cerrados" />
              <GlassCard padded={false} style={{ padding: theme.spacing(2) }}>
                {closed.map((item) => (
                  <GroupListItem key={item.group.id} item={item} />
                ))}
              </GlassCard>
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}
