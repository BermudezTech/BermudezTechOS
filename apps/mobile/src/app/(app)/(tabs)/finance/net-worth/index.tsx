import { router } from 'expo-router';

import { EmptyState, GlassCard, IconButton, Screen, SectionHeader } from '@/components/ui';
import { NetWorthBreakdown } from '@/modules/finance/components/netWorth/NetWorthBreakdown';
import { NetWorthChart } from '@/modules/finance/components/netWorth/NetWorthChart';
import { NetWorthHeader } from '@/modules/finance/components/netWorth/NetWorthHeader';
import { useNetWorth } from '@/modules/finance/hooks/useNetWorth';

export default function NetWorthScreen() {
  const { report, evolution } = useNetWorth();
  const empty = report.groups.length === 0;
  return (
    <Screen
      title="Patrimonio"
      subtitle="Activos − pasivos"
      back
      right={<IconButton icon="add" accessibilityLabel="Agregar bien" onPress={() => router.push('/finance/net-worth/assets/new')} />}>
      {empty ? (
        <EmptyState
          icon="analytics-outline"
          title="Aún no hay patrimonio que mostrar"
          message="Crea cuentas o registra tus bienes (vehículos, inmuebles…)."
          actionLabel="Agregar bien"
          onAction={() => router.push('/finance/net-worth/assets/new')}
        />
      ) : (
        <>
          <NetWorthHeader report={report} />
          <SectionHeader title="Últimos 12 meses" />
          <GlassCard>
            <NetWorthChart points={evolution} />
          </GlassCard>
          <SectionHeader title="Desglose" actionLabel="Agregar bien" onAction={() => router.push('/finance/net-worth/assets/new')} />
          <NetWorthBreakdown groups={report.groups} />
        </>
      )}
    </Screen>
  );
}
