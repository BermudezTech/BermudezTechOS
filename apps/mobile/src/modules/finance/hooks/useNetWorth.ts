import { useMemo } from 'react';

import { isAssetValueExpired, netWorthEvolution, netWorthReport } from '../domain/netWorth';
import { useActiveAccounts, useActiveAssets, useActiveCdts, useActiveTransactions, useToday } from './useFinanceData';

export { createAsset, deleteAsset, updateAsset } from '../data/local/assetsRepo';

export function useNetWorth() {
  const accounts = useActiveAccounts();
  const transactions = useActiveTransactions();
  const cdts = useActiveCdts();
  const assets = useActiveAssets();
  const today = useToday();
  return useMemo(
    () => ({
      report: netWorthReport(accounts, transactions, cdts, assets, today),
      evolution: netWorthEvolution(accounts, transactions, cdts, assets, today, 12),
    }),
    [accounts, transactions, cdts, assets, today],
  );
}

export function useAssets() {
  const assets = useActiveAssets();
  const today = useToday();
  return useMemo(() => assets.map((a) => ({ ...a, isValueExpired: isAssetValueExpired(a, today) })), [assets, today]);
}

export function useAsset(id: string | undefined) {
  const assets = useAssets();
  return useMemo(() => assets.find((a) => a.id === id), [assets, id]);
}
