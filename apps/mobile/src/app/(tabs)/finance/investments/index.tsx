import { router } from 'expo-router';

import { EmptyState, GlassCard, IconButton, Screen } from '@/components/ui';
import { CdtListItem } from '@/modules/finance/components/investments/CdtListItem';
import { InvestmentsHeader } from '@/modules/finance/components/investments/InvestmentsHeader';
import { useCdts } from '@/modules/finance/hooks/useCdts';
import { useTheme } from '@/theme';

export default function InvestmentsScreen() {
  const theme = useTheme();
  const { items, summary } = useCdts();
  return (
    <Screen
      title="Inversiones"
      subtitle="CDTs"
      back
      right={<IconButton icon="add" accessibilityLabel="Nuevo CDT" onPress={() => router.push('/finance/investments/new')} />}>
      {items.length === 0 ? (
        <EmptyState
          icon="trending-up-outline"
          title="Sin CDTs"
          message="Registra tus certificados de depósito para seguir su rendimiento."
          actionLabel="Nuevo CDT"
          onAction={() => router.push('/finance/investments/new')}
        />
      ) : (
        <>
          <InvestmentsHeader summary={summary} />
          <GlassCard padded={false} style={{ padding: theme.spacing(2) }}>
            {items.map((item) => (
              <CdtListItem key={item.cdt.id} item={item} />
            ))}
          </GlassCard>
        </>
      )}
    </Screen>
  );
}
