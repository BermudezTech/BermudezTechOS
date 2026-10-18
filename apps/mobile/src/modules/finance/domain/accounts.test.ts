import { cents } from '@/lib/money';

import { accountDetail, accountsSummary, availableTotal, creditCardMetrics, hasDependencies } from './accounts';
import { balancesByAccount } from './balances';
import { accountFormSchema } from './schemas/account';
import { makeAccount, makeTx } from './testUtils';

const savings = makeAccount({ id: 'sav', name: 'Ahorros', openingBalance: cents(1_000_000) });
const pocketA = makeAccount({ id: 'pa', type: 'POCKET', parentAccountId: 'sav' });
const pocketB = makeAccount({ id: 'pb', type: 'POCKET', parentAccountId: 'sav' });
const cash = makeAccount({ id: 'cash', type: 'CASH', openingBalance: cents(50_000) });
const card = makeAccount({ id: 'cc', type: 'CREDIT_CARD', creditLimit: cents(500_000) });
const cdt = makeAccount({ id: 'inv', type: 'INVESTMENT', openingBalance: cents(900_000) });
const archived = makeAccount({ id: 'old', isArchived: true, openingBalance: cents(7_000) });
const accounts = [savings, pocketA, pocketB, cash, card, cdt, archived];
const txs = [
  makeTx({ accountId: 'sav', counterAccountId: 'pa', type: 'TRANSFER', amount: cents(200_000) }),
  makeTx({ accountId: 'sav', counterAccountId: 'pb', type: 'TRANSFER', amount: cents(100_000) }),
  makeTx({ accountId: 'cc', type: 'EXPENSE', amount: cents(125_000) }),
];
const balances = balancesByAccount(accounts, txs);

describe('accountDetail', () => {
  it('calcula saldo total (propio + cajitas) y disponible (propio)', () => {
    const detail = accountDetail(savings, accounts, balances, txs);
    expect(detail.ownBalance).toBe(700_000);
    expect(detail.availableBalance).toBe(700_000);
    expect(detail.totalBalance).toBe(1_000_000);
    expect(detail.pockets.map((p) => p.ownBalance)).toEqual([200_000, 100_000]);
    expect(detail.recentTransactions).toHaveLength(2);
  });

  it('calcula métricas de tarjeta', () => {
    const detail = accountDetail(card, accounts, balances, txs);
    expect(detail.debt).toBe(125_000);
    expect(detail.card?.availableCredit).toBe(375_000);
    expect(detail.card?.usedPct.toNumber()).toBe(25);
    expect(creditCardMetrics(savings, cents(0))).toBeNull();
  });
});

describe('accountsSummary', () => {
  it('agrupa activos y pasivos y excluye archivadas por defecto', () => {
    const summary = accountsSummary(accounts, balances);
    expect(summary.assets.map((g) => g.key)).toEqual(['BANK', 'CASH', 'INVESTMENT']);
    expect(summary.liabilities[0]?.total).toBe(125_000);
    expect(summary.assets.flatMap((g) => g.items).some((i) => i.account.id === 'old')).toBe(false);
    expect(summary.assets.flatMap((g) => g.items).some((i) => i.account.type === 'POCKET')).toBe(false);
    expect(accountsSummary(accounts, balances, { includeArchived: true }).assets[0]?.items).toHaveLength(2);
  });

  it('el disponible total excluye inversiones, tarjetas, cajitas y archivadas', () => {
    expect(availableTotal(accounts, balances)).toBe(700_000 + 50_000);
  });

  it('detecta dependencias', () => {
    expect(hasDependencies('sav', accounts, txs)).toBe(true);
    expect(hasDependencies('cash', accounts, txs)).toBe(false);
  });
});

describe('accountFormSchema', () => {
  const base = {
    type: 'SAVINGS' as const,
    name: 'Ahorros',
    parentAccountId: null,
    openingBalance: '0',
    creditLimit: '',
    statementDay: '',
    paymentDueDay: '',
    icon: null,
    color: null,
    isExcludedFromNetWorth: false,
  };

  it('acepta una cuenta válida', () => {
    expect(accountFormSchema.safeParse(base).success).toBe(true);
  });

  it('exige padre en cajitas', () => {
    const r = accountFormSchema.safeParse({ ...base, type: 'POCKET' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['parentAccountId']);
  });

  it('exige cupo en tarjetas y valida días 1–31', () => {
    expect(accountFormSchema.safeParse({ ...base, type: 'CREDIT_CARD' }).success).toBe(false);
    const r = accountFormSchema.safeParse({ ...base, type: 'CREDIT_CARD', creditLimit: '1000000', statementDay: '32' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['statementDay']);
  });

  it('rechaza nombre vacío y saldo inválido', () => {
    expect(accountFormSchema.safeParse({ ...base, name: '  ' }).success).toBe(false);
    expect(accountFormSchema.safeParse({ ...base, openingBalance: '-5' }).success).toBe(false);
  });
});
