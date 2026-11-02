import { cents } from '@/lib/money';

import { firstNetWorthMonth, isAssetValueExpired, netWorthEvolution, netWorthMonthsFor, netWorthReport } from './netWorth';
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
  const cdtValue = cdt.principal;

  it('neto = activos − pasivos, con el CDT por su capital y sin doble conteo', () => {
    // Cuentas: ahorros 500.000 + cajita 100.000 (la cuenta del CDT no se suma).
    expect(report.assetsTotal).toBe(600_000 + cdtValue + 5_000_000);
    expect(report.liabilitiesTotal).toBe(200_000);
    expect(report.netWorth).toBe(report.assetsTotal - 200_000);
    expect(report.groups.flatMap((g) => g.items).some((i) => i.id === 'inv')).toBe(false);
  });

  it('un ingreso por interés ligado al CDT no cambia su valor (spec 009)', () => {
    const interest = makeTx({ accountId: 'inv', type: 'INCOME', amount: cents(20_000), on: '2026-10-01', cdtId: 'cdt' });
    const withInterest = netWorthReport(accounts, [...txs, interest], [cdt], [car], TODAY);
    expect(withInterest.groups.find((g) => g.key === 'INVESTMENTS')?.total).toBe(cdt.principal);
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

describe('firstNetWorthMonth', () => {
  const at = (iso: string) => ({ createdAt: iso });

  it('toma el dato más antiguo entre movimientos, CDTs, cuentas y bienes', () => {
    const acc = makeAccount({ ...at('2026-05-03T15:00:00.000Z') });
    expect(firstNetWorthMonth([acc], txs, [cdt], [{ ...car, createdAt: '2026-06-01T15:00:00.000Z' }])).toBe('2026-05-01');
    expect(firstNetWorthMonth([], txs, [cdt], [])).toBe('2026-08-01');
    expect(firstNetWorthMonth([], [], [makeCdt({ openedOn: '2025-12-20' })], [])).toBe('2025-12-01');
  });

  it('usa el mes de Bogotá e ignora borrados', () => {
    // 1 de marzo 02:00 UTC = 28 de febrero en Bogotá.
    expect(firstNetWorthMonth([makeAccount(at('2026-03-01T02:00:00.000Z'))], [], [], [])).toBe('2026-02-01');
    expect(
      firstNetWorthMonth([makeAccount({ ...at('2020-01-01T15:00:00.000Z'), deletedAt: '2021-01-01T00:00:00.000Z' })], [], [], []),
    ).toBeNull();
  });
});

describe('netWorthMonthsFor', () => {
  it('recorta el rango al historial disponible', () => {
    // De marzo a octubre: 8 meses de historial.
    expect(netWorthMonthsFor('6M', '2026-03-01', TODAY)).toBe(6);
    expect(netWorthMonthsFor('12M', '2026-03-01', TODAY)).toBe(8);
    expect(netWorthMonthsFor('24M', '2026-03-01', TODAY)).toBe(8);
    expect(netWorthMonthsFor('ALL', '2026-03-01', TODAY)).toBe(8);
  });

  it('con historial largo "Todo" abarca todos los meses', () => {
    expect(netWorthMonthsFor('24M', '2023-01-01', TODAY)).toBe(24);
    expect(netWorthMonthsFor('ALL', '2023-01-01', TODAY)).toBe(46);
  });

  it('sin datos dibuja solo el mes en curso', () => {
    for (const range of ['6M', '12M', '24M', 'ALL'] as const) expect(netWorthMonthsFor(range, null, TODAY)).toBe(1);
  });

  it('netWorthEvolution acepta rangos largos', () => {
    const points = netWorthEvolution(accounts, txs, [cdt], [car], TODAY, 30);
    expect(points).toHaveLength(30);
    expect(points[29]?.date).toBe(TODAY);
  });
});
