import { cents } from '@/lib/money';

import { currentValue } from './cdtValuation';
import { isAssetValueExpired, netWorthEvolution, netWorthReport } from './netWorth';
import { makeAccount, makeCdt, makeTx } from './testUtils';
import type { Asset } from './types';

const TODAY = '2026-10-17';
const savings = makeAccount({ id: 'sav', openingBalance: cents(1_000_000) });
const pocket = makeAccount({ id: 'pk', type: 'POCKET', parentAccountId: 'sav' });
const card = makeAccount({ id: 'cc', type: 'CREDIT_CARD', creditLimit: cents(500_000) });
const foreign = makeAccount({ id: 'mom', openingBalance: cents(300_000), isExcludedFromNetWorth: true });
const invAccount = makeAccount({ id: 'inv', type: 'INVESTMENT' });
const cdt = makeCdt({
  id: 'cdt',
  accountId: 'inv',
  principal: cents(400_000),
  openedOn: '2026-09-01',
  termDays: 180,
  maturesOn: '2027-02-28',
});
const car: Asset = {
  id: 'car',
  createdAt: '',
  updatedAt: '',
  deletedAt: null,
  name: 'Carro',
  value: cents(5_000_000),
  validUntil: '2026-09-30',
};

const txs = [
  makeTx({ accountId: 'sav', counterAccountId: 'pk', type: 'TRANSFER', amount: cents(100_000), on: '2026-08-10' }),
  makeTx({ accountId: 'sav', counterAccountId: 'inv', type: 'TRANSFER', amount: cents(400_000), on: '2026-09-01' }),
  makeTx({ accountId: 'cc', type: 'EXPENSE', amount: cents(200_000), on: '2026-10-05' }),
];
const accounts = [savings, pocket, card, foreign, invAccount];

describe('netWorthReport', () => {
  const report = netWorthReport(accounts, txs, [cdt], [car], TODAY);
  const cdtValue = currentValue(cdt, cents(0), TODAY);

  it('neto = activos − pasivos, con el CDT por su valor actual y sin doble conteo', () => {
    // Cuentas: ahorros 500.000 + cajita 100.000 (la cuenta del CDT no se suma).
    expect(report.assetsTotal).toBe(600_000 + cdtValue + 5_000_000);
    expect(report.liabilitiesTotal).toBe(200_000);
    expect(report.netWorth).toBe(report.assetsTotal - 200_000);
    expect(report.groups.flatMap((g) => g.items).some((i) => i.id === 'inv')).toBe(false);
  });

  it('marca y no suma las cuentas excluidas', () => {
    expect(report.excluded.map((e) => e.id)).toEqual(['mom']);
    expect(report.groups.find((g) => g.key === 'ACCOUNTS')?.total).toBe(600_000);
  });

  it('marca los bienes con valor vencido', () => {
    expect(report.groups.find((g) => g.key === 'ASSETS')?.items[0]?.expired).toBe(true);
    expect(isAssetValueExpired(car, '2026-09-30')).toBe(false);
  });
});

describe('netWorthEvolution', () => {
  it('devuelve 12 puntos y el último coincide con el neto actual', () => {
    const points = netWorthEvolution(accounts, txs, [cdt], [car], TODAY, 12);
    expect(points).toHaveLength(12);
    expect(points[11]).toEqual({ date: TODAY, netWorth: netWorthReport(accounts, txs, [cdt], [car], TODAY).netWorth });
    expect(points[10]?.date).toBe('2026-09-30');
    // En julio aún no existía la deuda ni el CDT: 1.000.000 (ahorros) + bien.
    expect(points[8]).toEqual({ date: '2026-07-31', netWorth: 1_000_000 + 5_000_000 });
  });
});
