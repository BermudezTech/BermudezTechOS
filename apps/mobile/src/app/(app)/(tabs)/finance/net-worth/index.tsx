import { router } from 'expo-router';
import { useState } from 'react';

import { EmptyState, GlassCard, IconButton, Screen, SectionHeader } from '@/components/ui';
import { NetWorthBreakdown } from '@/modules/finance/components/netWorth/NetWorthBreakdown';
import { NetWorthChart } from '@/modules/finance/components/netWorth/NetWorthChart';
import { NetWorthHeader } from '@/modules/finance/components/netWorth/NetWorthHeader';
import { NetWorthRangeSelector } from '@/modules/finance/components/netWorth/NetWorthRangeSelector';
import type { NetWorthRange } from '@/modules/finance/domain/netWorth';
import { formatDateLocal } from '@/lib/dates';
import { useNetWorth } from '@/modules/finance/hooks/useNetWorth';

const RANGE_TITLES: Record<Exclude<NetWorthRange, 'ALL'>, string> = {
  '6M': 'Últimos 6 meses',
  '12M': 'Últimos 12 meses',
  '24M': 'Últimos 24 meses',
};

export default function NetWorthScreen() {
  const [range, setRange] = useState<NetWorthRange>('12M');
  const { report, evolution, firstMonth } = useNetWorth(range);
  const chartTitle =
    range === 'ALL' ? (firstMonth ? `Desde ${formatDateLocal(firstMonth, 'MMMM yyyy')}` : 'Todo el historial') : RANGE_TITLES[range];
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
          <SectionHeader title={chartTitle} />
          <NetWorthRangeSelector value={range} onChange={setRange} />
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
