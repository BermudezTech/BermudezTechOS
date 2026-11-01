import { useMemo } from 'react';

import {
  firstNetWorthMonth,
  isAssetValueExpired,
  netWorthEvolution,
  netWorthMonthsFor,
  netWorthReport,
  type NetWorthRange,
} from '../domain/netWorth';
import { useActiveAccounts, useActiveAssets, useActiveCdts, useActiveTransactions, useToday } from './useFinanceData';

export { createAsset, deleteAsset, updateAsset } from '../data/local/assetsRepo';

/** Patrimonio actual y su evolución en el rango elegido (por defecto 12 meses). */
export function useNetWorth(range: NetWorthRange = '12M') {
  const accounts = useActiveAccounts();
  const transactions = useActiveTransactions();
  const cdts = useActiveCdts();
  const assets = useActiveAssets();
  const today = useToday();
  const report = useMemo(() => netWorthReport(accounts, transactions, cdts, assets, today), [accounts, transactions, cdts, assets, today]);
  const firstMonth = useMemo(() => firstNetWorthMonth(accounts, transactions, cdts, assets), [accounts, transactions, cdts, assets]);
  const evolution = useMemo(
    () => netWorthEvolution(accounts, transactions, cdts, assets, today, netWorthMonthsFor(range, firstMonth, today)),
    [accounts, transactions, cdts, assets, today, range, firstMonth],
  );
  return { report, evolution, firstMonth };
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
