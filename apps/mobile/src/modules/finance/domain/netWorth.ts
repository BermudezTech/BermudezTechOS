import { addDays, isoDate, localDayKey, parseIsoDate, periodRangeUtc, shiftPeriod, type IsoDate } from '@/lib/dates';
import { add, sub, sum, ZERO, type Cents } from '@/lib/money';

import { balancesByAccount, debtOf } from './balances';
import { currentValue } from './cdtValuation';
import type { Account, Asset, Cdt, Transaction } from './types';

export type NetWorthGroupKey = 'ACCOUNTS' | 'INVESTMENTS' | 'ASSETS' | 'LIABILITIES';

export interface NetWorthEntry {
  id: string;
  name: string;
  /** Valor positivo: saldo/valor en activos, deuda en pasivos. */
  value: Cents;
  excluded: boolean;
  /** Solo bienes: el valor estimado venció. */
  expired: boolean;
  icon: string | null;
  color: string | null;
  kind: 'account' | 'cdt' | 'asset';
}

export interface NetWorthGroup {
  key: NetWorthGroupKey;
  label: string;
  items: NetWorthEntry[];
  /** Suma de los elementos no excluidos. */
  total: Cents;
}

export interface NetWorthReport {
  netWorth: Cents;
  assetsTotal: Cents;
  liabilitiesTotal: Cents;
  groups: NetWorthGroup[];
  excluded: NetWorthEntry[];
}

export interface NetWorthPoint {
  /** Último día del mes (o hoy en el mes actual). */
  date: IsoDate;
  netWorth: Cents;
}

export function isAssetValueExpired(asset: Pick<Asset, 'validUntil'>, today: IsoDate): boolean {
  return asset.validUntil < today;
}

const labels: Record<NetWorthGroupKey, string> = {
  ACCOUNTS: 'Cuentas',
  INVESTMENTS: 'Inversiones (CDT)',
  ASSETS: 'Bienes',
  LIABILITIES: 'Deudas',
};

/** Intereses de CDT ya recibidos (ingresos ligados al CDT). */
function paidInterest(cdt: Cdt, transactions: Transaction[]): Cents {
  return sum(transactions.filter((t) => t.cdtId === cdt.id && t.type === 'INCOME' && !t.deletedAt).map((t) => t.amount));
}

function isCdtAlive(cdt: Cdt, date: IsoDate): boolean {
  if (cdt.deletedAt || cdt.status === 'CANCELLED') return false;
  return cdt.openedOn <= date && (cdt.status === 'ACTIVE' ? true : cdt.maturesOn > date);
}

/**
 * Patrimonio neto = Σ activos (cuentas ASSET + valor actual de CDTs + bienes) − Σ deudas
 * (LIABILITY), excluyendo `isExcludedFromNetWorth` (data-model). Las cuentas INVESTMENT de
 * un CDT se cuentan por el valor del CDT, no dos veces.
 */
export function netWorthReport(
  accounts: Account[],
  transactions: Transaction[],
  cdts: Cdt[],
  assets: Asset[],
  today: IsoDate,
): NetWorthReport {
  return buildReport(accounts, transactions, cdts, assets, today, balancesByAccount(accounts, transactions));
}

function buildReport(
  accounts: Account[],
  transactions: Transaction[],
  cdts: Cdt[],
  assets: Asset[],
  date: IsoDate,
  balances: Map<string, Cents>,
): NetWorthReport {
  const cdtAccountIds = new Set(cdts.filter((c) => !c.deletedAt).map((c) => c.accountId));
  const live = accounts.filter((a) => !a.deletedAt && !a.isArchived);

  const accountItems: NetWorthEntry[] = [];
  const liabilityItems: NetWorthEntry[] = [];
  for (const account of live) {
    if (account.type === 'POCKET' || cdtAccountIds.has(account.id)) continue;
    const own = balances.get(account.id) ?? ZERO;
    const pockets = live.filter((p) => p.parentAccountId === account.id).map((p) => balances.get(p.id) ?? ZERO);
    const entry = (value: Cents): NetWorthEntry => ({
      id: account.id,
      name: account.name,
      value,
      excluded: account.isExcludedFromNetWorth,
      expired: false,
      icon: account.icon,
      color: account.color,
      kind: 'account',
    });
    if (account.nature === 'LIABILITY') liabilityItems.push(entry(debtOf(own)));
    else accountItems.push(entry(add(own, sum(pockets))));
  }

  const investmentItems: NetWorthEntry[] = cdts
    .filter((c) => isCdtAlive(c, date))
    .map((c) => {
      const account = accounts.find((a) => a.id === c.accountId);
      return {
        id: c.id,
        name: `CDT ${c.issuer}`,
        value: currentValue(c, paidInterest(c, transactions), date),
        excluded: account?.isExcludedFromNetWorth ?? false,
        expired: false,
        icon: 'trending-up-outline',
        color: account?.color ?? null,
        kind: 'cdt',
      };
    });

  const assetItems: NetWorthEntry[] = assets
    .filter((a) => !a.deletedAt)
    .map((a) => ({
      id: a.id,
      name: a.name,
      value: a.value,
      excluded: false,
      expired: isAssetValueExpired(a, date),
      icon: 'car-outline',
      color: null,
      kind: 'asset',
    }));

  const group = (key: NetWorthGroupKey, items: NetWorthEntry[]): NetWorthGroup => ({
    key,
    label: labels[key],
    items: [...items].sort((a, b) => b.value - a.value),
    total: sum(items.filter((i) => !i.excluded).map((i) => i.value)),
  });
  const groups = [
    group('ACCOUNTS', accountItems),
    group('INVESTMENTS', investmentItems),
    group('ASSETS', assetItems),
    group('LIABILITIES', liabilityItems),
  ];
  const assetsTotal = sum(groups.filter((g) => g.key !== 'LIABILITIES').map((g) => g.total));
  const liabilitiesTotal = groups.find((g) => g.key === 'LIABILITIES')!.total;

  return {
    netWorth: sub(assetsTotal, liabilitiesTotal),
    assetsTotal,
    liabilitiesTotal,
    groups: groups.filter((g) => g.items.length > 0),
    excluded: groups.flatMap((g) => g.items.filter((i) => i.excluded)),
  };
}

/** Patrimonio al cierre de cada uno de los últimos `months` meses (el actual, a hoy). Bienes con su valor actual. */
export function netWorthEvolution(
  accounts: Account[],
  transactions: Transaction[],
  cdts: Cdt[],
  assets: Asset[],
  today: IsoDate,
  months = 12,
): NetWorthPoint[] {
  const { year, month } = parseIsoDate(today);
  const current = { granularity: 'MONTH' as const, anchor: isoDate(year, month, 1) };
  // Ordenar una vez y tomar un prefijo por mes evita reinterpretar todas las fechas en cada mes (research R12).
  const sorted = transactions.map((t) => ({ t, at: Date.parse(t.occurredAt) })).sort((a, b) => a.at - b.at);
  return Array.from({ length: months }, (_, i) => {
    const period = shiftPeriod(current, i - (months - 1));
    const { toUtc } = periodRangeUtc(period);
    const isCurrent = i === months - 1;
    const date = isCurrent ? today : addDays(localDayKey(toUtc), -1);
    const until = isCurrent ? transactions : sorted.slice(0, countBefore(sorted, Date.parse(toUtc))).map((x) => x.t);
    const report = buildReport(accounts, until, cdts, assets, date, balancesByAccount(accounts, until));
    return { date, netWorth: report.netWorth };
  });
}

/** Cantidad de elementos con `at` < cutoff en una lista ordenada (búsqueda binaria). */
function countBefore(sorted: { at: number }[], cutoff: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid]!.at < cutoff) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export type NetWorthRange = '6M' | '12M' | '24M' | 'ALL';

const RANGE_MONTHS: Record<Exclude<NetWorthRange, 'ALL'>, number> = { '6M': 6, '12M': 12, '24M': 24 };

/**
 * Primer mes local con datos patrimoniales: el más antiguo entre movimientos, apertura de CDTs y
 * creación de cuentas y bienes. null si no hay ninguno (research R12).
 */
export function firstNetWorthMonth(accounts: Account[], transactions: Transaction[], cdts: Cdt[], assets: Asset[]): IsoDate | null {
  const days = [
    ...transactions.filter((t) => !t.deletedAt).map((t) => localDayKey(t.occurredAt)),
    ...cdts.filter((c) => !c.deletedAt).map((c) => c.openedOn),
    ...[...accounts, ...assets].filter((r) => !r.deletedAt && r.createdAt).map((r) => localDayKey(r.createdAt)),
  ];
  if (days.length === 0) return null;
  return `${days.reduce((a, b) => (b < a ? b : a)).slice(0, 7)}-01`;
}

/** Meses a dibujar: el rango, recortado al historial disponible (FR-022); sin datos, solo el mes en curso. */
export function netWorthMonthsFor(range: NetWorthRange, firstMonth: IsoDate | null, today: IsoDate): number {
  if (firstMonth === null) return 1;
  const first = parseIsoDate(firstMonth);
  const now = parseIsoDate(today);
  const history = Math.max(1, (now.year - first.year) * 12 + (now.month - first.month) + 1);
  return range === 'ALL' ? history : Math.min(RANGE_MONTHS[range], history);
}
