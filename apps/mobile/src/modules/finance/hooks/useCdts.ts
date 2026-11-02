import { useMemo } from 'react';

import { cdtSummary, cdtValues, sortByMaturity } from '../domain/cdts';
import { useActiveCdts, useToday } from './useFinanceData';

export { cdtDeletionPreview, createCdt, deleteCdt, renewCdt, updateCdt } from '../data/local/cdtsRepo';

export function useCdts() {
  const cdts = useActiveCdts();
  const today = useToday();
  return useMemo(
    () => ({
      // Los periodos renovados no se listan aparte: se ven en el historial del vigente (spec 009).
      items: sortByMaturity(cdts.filter((c) => c.status !== 'RENEWED')).map((c) => cdtValues(c, cdts, today)),
      summary: cdtSummary(cdts),
    }),
    [cdts, today],
  );
}

export function useCdt(id: string | undefined) {
  const cdts = useActiveCdts();
  const today = useToday();
  return useMemo(() => {
    const cdt = cdts.find((c) => c.id === id);
    return cdt ? cdtValues(cdt, cdts, today) : undefined;
  }, [cdts, today, id]);
}
