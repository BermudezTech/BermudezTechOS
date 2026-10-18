import { Decimal } from 'decimal.js';

import { add, percentOf, sub, sum, ZERO, type Cents } from '@/lib/money';

import { debtOf } from './balances';
import type { Account, AccountType, Transaction } from './types';

export interface AccountWithBalance {
  account: Account;
  /** Saldo propio con signo (sin cajitas). */
  ownBalance: Cents;
  /** Propio + Σ cajitas. */
  totalBalance: Cents;
  /** Solo en LIABILITY: deuda positiva. */
  debt: Cents | null;
}

export interface CreditCardMetrics {
  debt: Cents;
  creditLimit: Cents;
  availableCredit: Cents;
  /** Porcentaje 0–100 (o más si se excede el cupo). */
  usedPct: Decimal;
}

export interface AccountDetail extends AccountWithBalance {
  /** = saldo propio (excluye lo apartado en cajitas). */
  availableBalance: Cents;
  pockets: AccountWithBalance[];
  parent: Account | null;
  card: CreditCardMetrics | null;
  recentTransactions: Transaction[];
}

export type AccountGroupKey = 'BANK' | 'CASH' | 'INVESTMENT' | 'CARDS';

export interface AccountGroup {
  key: AccountGroupKey;
  label: string;
  items: AccountWithBalance[];
  /** Activos: Σ totalBalance; tarjetas: Σ deuda. */
  total: Cents;
}

export interface AccountsSummary {
  assets: AccountGroup[];
  liabilities: AccountGroup[];
  assetsTotal: Cents;
  liabilitiesTotal: Cents;
  availableTotal: Cents;
}

const groupOf: Record<Exclude<AccountType, 'POCKET'>, AccountGroupKey> = {
  CHECKING: 'BANK',
  SAVINGS: 'BANK',
  CASH: 'CASH',
  INVESTMENT: 'INVESTMENT',
  CREDIT_CARD: 'CARDS',
};

const groupLabels: Record<AccountGroupKey, string> = {
  BANK: 'Cuentas bancarias',
  CASH: 'Efectivo',
  INVESTMENT: 'Inversiones',
  CARDS: 'Tarjetas de crédito',
};

function pocketsOf(parentId: string, accounts: Account[]): Account[] {
  return accounts.filter((a) => a.parentAccountId === parentId && !a.deletedAt);
}

export function withBalance(account: Account, accounts: Account[], balances: Map<string, Cents>): AccountWithBalance {
  const own = balances.get(account.id) ?? ZERO;
  const pockets = pocketsOf(account.id, accounts).map((p) => balances.get(p.id) ?? ZERO);
  return {
    account,
    ownBalance: own,
    totalBalance: add(own, sum(pockets)),
    debt: account.nature === 'LIABILITY' ? debtOf(own) : null,
  };
}

export function creditCardMetrics(account: Account, debt: Cents): CreditCardMetrics | null {
  if (account.type !== 'CREDIT_CARD' || account.creditLimit === null) return null;
  return {
    debt,
    creditLimit: account.creditLimit,
    availableCredit: sub(account.creditLimit, debt),
    usedPct: percentOf(debt, account.creditLimit),
  };
}

/** Detalle de cuenta: saldo total, disponible, cajitas, métricas de tarjeta y movimientos recientes. */
export function accountDetail(
  account: Account,
  accounts: Account[],
  balances: Map<string, Cents>,
  transactions: Transaction[],
  recentLimit = 10,
): AccountDetail {
  const base = withBalance(account, accounts, balances);
  const pockets = pocketsOf(account.id, accounts).map((p) => withBalance(p, accounts, balances));
  const ids = new Set([account.id, ...pockets.map((p) => p.account.id)]);
  const recentTransactions = transactions
    .filter((t) => !t.deletedAt && (ids.has(t.accountId) || (t.counterAccountId !== null && ids.has(t.counterAccountId))))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, recentLimit);
  return {
    ...base,
    availableBalance: base.ownBalance,
    pockets,
    parent: account.parentAccountId ? (accounts.find((a) => a.id === account.parentAccountId) ?? null) : null,
    card: base.debt !== null ? creditCardMetrics(account, base.debt) : null,
    recentTransactions,
  };
}

/** Lista agrupada en activos y pasivos (las cajitas van dentro de su cuenta principal). */
export function accountsSummary(
  accounts: Account[],
  balances: Map<string, Cents>,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): AccountsSummary {
  const visible = accounts
    .filter((a) => !a.deletedAt && a.type !== 'POCKET' && (includeArchived || !a.isArchived))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const groups = new Map<AccountGroupKey, AccountWithBalance[]>();
  for (const account of visible) {
    const key = groupOf[account.type as Exclude<AccountType, 'POCKET'>];
    groups.set(key, [...(groups.get(key) ?? []), withBalance(account, accounts, balances)]);
  }
  const build = (key: AccountGroupKey): AccountGroup | null => {
    const items = groups.get(key);
    if (!items?.length) return null;
    const total = sum(items.map((i) => i.debt ?? i.totalBalance));
    return { key, label: groupLabels[key], items, total };
  };
  const assets = (['BANK', 'CASH', 'INVESTMENT'] as const).map(build).filter((g): g is AccountGroup => g !== null);
  const liabilities = [build('CARDS')].filter((g): g is AccountGroup => g !== null);

  return {
    assets,
    liabilities,
    assetsTotal: sum(assets.map((g) => g.total)),
    liabilitiesTotal: sum(liabilities.map((g) => g.total)),
    availableTotal: availableTotal(accounts, balances),
  };
}

/** Σ saldos disponibles de cuentas ASSET no archivadas, excluyendo INVESTMENT (y las cajitas, que son lo apartado). */
export function availableTotal(accounts: Account[], balances: Map<string, Cents>): Cents {
  return sum(
    accounts
      .filter((a) => !a.deletedAt && !a.isArchived && a.nature === 'ASSET' && a.type !== 'INVESTMENT' && a.type !== 'POCKET')
      .map((a) => balances.get(a.id) ?? ZERO),
  );
}

/** Etiqueta "Cuenta › Cajita" para selectores. */
export function accountLabel(account: Account, accounts: Account[]): string {
  if (!account.parentAccountId) return account.name;
  const parent = accounts.find((a) => a.id === account.parentAccountId);
  return parent ? `${parent.name} › ${account.name}` : account.name;
}

export function hasDependencies(accountId: string, accounts: Account[], transactions: Transaction[]): boolean {
  return (
    accounts.some((a) => !a.deletedAt && a.parentAccountId === accountId) ||
    transactions.some((t) => !t.deletedAt && (t.accountId === accountId || t.counterAccountId === accountId))
  );
}
