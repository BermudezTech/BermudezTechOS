import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo } from 'react';

import { todayLocal, type Granularity, type Period } from '@/lib/dates';

/** Periodo leído de la URL (`?granularity=&anchor=`); por defecto el mes actual. */
export function usePeriodParams(): [Period, (period: Period) => void] {
  const params = useLocalSearchParams<{ granularity?: Granularity; anchor?: string }>();
  const period = useMemo<Period>(
    () => ({
      granularity: params.granularity === 'YEAR' ? 'YEAR' : 'MONTH',
      anchor: params.anchor && /^\d{4}-\d{2}-\d{2}$/.test(params.anchor) ? params.anchor : todayLocal(),
    }),
    [params.granularity, params.anchor],
  );
  const setPeriod = useCallback((p: Period) => router.setParams({ granularity: p.granularity, anchor: p.anchor }), []);
  return [period, setPeriod];
}
