import { useMemo } from 'react';

import type { IsoDate } from '@/lib/dates';

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

/**
 * Patrimonio actual y su evolución en el rango elegido (por defecto 12 meses). `today` permite
 * a Inicio pasar una fecha viva (spec 010); si se omite se usa la del montaje.
 */
export function useNetWorth(range: NetWorthRange = '12M', todayOverride?: IsoDate) {
  const accounts = useActiveAccounts();
  const transactions = useActiveTransactions();
  const cdts = useActiveCdts();
  const assets = useActiveAssets();
  const mountedToday = useToday();
  const today = todayOverride ?? mountedToday;
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
