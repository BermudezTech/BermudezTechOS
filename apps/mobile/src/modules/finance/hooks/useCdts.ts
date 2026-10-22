import { useMemo } from 'react';

import { cdtSummary, cdtValues, sortByMaturity } from '../domain/cdts';
import { useActiveCdts, useActiveTransactions, useToday } from './useFinanceData';

export { createCdt, updateCdt } from '../data/local/cdtsRepo';

export function useCdts() {
  const cdts = useActiveCdts();
  const transactions = useActiveTransactions();
  const today = useToday();
  return useMemo(
    () => ({ items: sortByMaturity(cdts).map((c) => cdtValues(c, transactions, today)), summary: cdtSummary(cdts) }),
    [cdts, transactions, today],
  );
}

export function useCdt(id: string | undefined) {
  const cdts = useActiveCdts();
  const transactions = useActiveTransactions();
  const today = useToday();
  return useMemo(() => {
    const cdt = cdts.find((c) => c.id === id);
    return cdt ? cdtValues(cdt, transactions, today) : undefined;
  }, [cdts, transactions, today, id]);
}
