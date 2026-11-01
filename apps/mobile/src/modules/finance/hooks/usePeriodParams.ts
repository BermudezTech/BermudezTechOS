import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo } from 'react';

import { clampPeriod, todayLocal, type Granularity, type IsoDate, type Period } from '@/lib/dates';

/**
 * Periodo leído de la URL (`?granularity=&anchor=`); por defecto el mes actual. Con `min`, el
 * periodo se ajusta a [periodo de `min`, periodo en curso] (contracts/navigation.md de la spec 008).
 */
export function usePeriodParams(min?: IsoDate | null): [Period, (period: Period) => void] {
  const params = useLocalSearchParams<{ granularity?: Granularity; anchor?: string }>();
  const period = useMemo<Period>(() => {
    const raw: Period = {
      granularity: params.granularity === 'YEAR' ? 'YEAR' : 'MONTH',
      anchor: params.anchor && /^\d{4}-\d{2}-\d{2}$/.test(params.anchor) ? params.anchor : todayLocal(),
    };
    return min === undefined ? raw : clampPeriod(raw, min);
  }, [params.granularity, params.anchor, min]);
  const setPeriod = useCallback((p: Period) => router.setParams({ granularity: p.granularity, anchor: p.anchor }), []);
  return [period, setPeriod];
}
