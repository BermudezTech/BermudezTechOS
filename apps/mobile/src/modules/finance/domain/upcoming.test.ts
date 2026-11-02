import { cents, type Cents } from '@/lib/money';

import { maturityValue } from './cdtValuation';
import { makeAccount, makeCdt, makeSubscription } from './testUtils';
import type { Account, Cdt, Subscription } from './types';
import { daysUntilLabel, nextMonthlyDate, upcomingItems, type UpcomingInput } from './upcoming';

const TODAY = '2026-10-17';

function input(
  over: Partial<{ subscriptions: Subscription[]; cdts: Cdt[]; accounts: Account[]; balances: [string, number][] }> = {},
): UpcomingInput {
  return {
    subscriptions: over.subscriptions ?? [],
    cdts: over.cdts ?? [],
    accounts: over.accounts ?? [],
    balances: new Map((over.balances ?? []).map(([id, v]) => [id, cents(v)] as [string, Cents])),
  };
}

const card = (over: Partial<Account> = {}) =>
  makeAccount({ id: 'cc', name: 'Visa', type: 'CREDIT_CARD', creditLimit: cents(1_000_000), paymentDueDay: 25, ...over });

describe('nextMonthlyDate', () => {
  it('devuelve el día de este mes si aún no pasa, incluido hoy', () => {
    expect(nextMonthlyDate(25, TODAY)).toBe('2026-10-25');
    expect(nextMonthlyDate(17, TODAY)).toBe('2026-10-17');
  });

  it('pasa al mes siguiente si ya pasó, también en diciembre', () => {
    expect(nextMonthlyDate(5, TODAY)).toBe('2026-11-05');
    expect(nextMonthlyDate(5, '2026-12-20')).toBe('2027-01-05');
  });

  it('ajusta al último día de meses cortos, con y sin bisiesto', () => {
    expect(nextMonthlyDate(31, '2026-11-02')).toBe('2026-11-30');
    expect(nextMonthlyDate(31, '2027-02-01')).toBe('2027-02-28');
    expect(nextMonthlyDate(30, '2028-02-10')).toBe('2028-02-29');
    // El 31 de enero ya pasó → febrero, ajustado.
    expect(nextMonthlyDate(31, '2028-02-01')).toBe('2028-02-29');
  });
});

describe('upcomingItems: suscripciones', () => {
  it('incluye las activas dentro de la ventana con su monto y fecha de cobro', () => {
    const sub = makeSubscription({ id: 's1', name: 'Netflix', billingDay: 20, amount: cents(4_490_000) });
    const [item] = upcomingItems(input({ subscriptions: [sub] }), TODAY);
    expect(item).toEqual({
      kind: 'SUBSCRIPTION',
      sourceId: 's1',
      name: 'Netflix',
      date: '2026-10-20',
      daysUntil: 3,
      amount: 4_490_000,
      urgent: false,
      overdue: false,
    });
  });

  it('ajusta el día 31 al fin de mes', () => {
    const sub = makeSubscription({ billingDay: 31 });
    expect(upcomingItems(input({ subscriptions: [sub] }), '2026-11-20')[0]?.date).toBe('2026-11-30');
  });

  it('anual: dentro de la ventana se incluye; fuera, no', () => {
    const inside = makeSubscription({ id: 'in', billingCycle: 'YEARLY', billingMonth: 10, billingDay: 30 });
    const outside = makeSubscription({ id: 'out', billingCycle: 'YEARLY', billingMonth: 6, billingDay: 20 });
    expect(upcomingItems(input({ subscriptions: [inside, outside] }), TODAY).map((i) => i.sourceId)).toEqual(['in']);
  });

  it('respeta la ventana de 15 días (incluido el día 15, excluido el 16)', () => {
    const day15 = makeSubscription({ id: 'd15', billingDay: 1, startDate: '2026-11-01' });
    const day16 = makeSubscription({ id: 'd16', billingDay: 2, startDate: '2026-11-02' });
    expect(upcomingItems(input({ subscriptions: [day15, day16] }), TODAY).map((i) => i.sourceId)).toEqual(['d15']);
  });

  it('con fecha de inicio futura cuenta el primer cobro desde el inicio', () => {
    const sub = makeSubscription({ billingDay: 1, startDate: '2026-10-25' });
    // El primer día 1 ≥ inicio es el 1 de noviembre.
    expect(upcomingItems(input({ subscriptions: [sub] }), TODAY)[0]?.date).toBe('2026-11-01');
  });

  it('excluye pausadas, canceladas y borradas', () => {
    const subs = [
      makeSubscription({ status: 'PAUSED', billingDay: 20 }),
      makeSubscription({ status: 'CANCELLED', billingDay: 20 }),
      makeSubscription({ billingDay: 20, deletedAt: '2026-10-01T00:00:00.000Z' }),
    ];
    expect(upcomingItems(input({ subscriptions: subs }), TODAY)).toEqual([]);
  });
});

describe('upcomingItems: CDTs', () => {
  it('incluye el activo que vence dentro de 15 días con su valor al vencimiento', () => {
    const cdt = makeCdt({ id: 'c1', issuer: 'Bancolombia', maturesOn: '2026-11-01' });
    const [item] = upcomingItems(input({ cdts: [cdt] }), TODAY);
    expect(item).toMatchObject({ kind: 'CDT_MATURITY', sourceId: 'c1', name: 'CDT Bancolombia', date: '2026-11-01', daysUntil: 15 });
    expect(item?.amount).toBe(maturityValue(cdt));
  });

  it('excluye el que vence en 16 días', () => {
    expect(upcomingItems(input({ cdts: [makeCdt({ maturesOn: '2026-11-02' })] }), TODAY)).toEqual([]);
  });

  it('usa el valor ajustado por el banco si existe', () => {
    const cdt = makeCdt({ maturesOn: '2026-10-20', maturityValueOverride: cents(1_234_567_89) });
    expect(upcomingItems(input({ cdts: [cdt] }), TODAY)[0]?.amount).toBe(1_234_567_89);
  });

  it('el activo ya vencido aparece primero, marcado como vencido', () => {
    const overdue = makeCdt({ id: 'late', maturesOn: '2026-10-14' });
    const sub = makeSubscription({ id: 'today', billingDay: 17 });
    const items = upcomingItems(input({ cdts: [overdue], subscriptions: [sub] }), TODAY);
    expect(items.map((i) => i.sourceId)).toEqual(['late', 'today']);
    expect(items[0]).toMatchObject({ daysUntil: -3, overdue: true, urgent: true });
  });

  it('excluye renovados, vencidos (MATURED), cancelados y borrados', () => {
    const cdts = (['RENEWED', 'MATURED', 'CANCELLED'] as const).map((status) => makeCdt({ status, maturesOn: '2026-10-20' }));
    cdts.push(makeCdt({ maturesOn: '2026-10-20', deletedAt: '2026-10-01T00:00:00.000Z' }));
    expect(upcomingItems(input({ cdts }), TODAY)).toEqual([]);
  });
});

describe('upcomingItems: tarjetas de crédito', () => {
  it('incluye la tarjeta con deuda y día de pago, con la deuda como monto', () => {
    // Saldo con signo de un pasivo: negativo = deuda.
    const [item] = upcomingItems(input({ accounts: [card()], balances: [['cc', -350_000]] }), TODAY);
    expect(item).toEqual({
      kind: 'CARD_PAYMENT',
      sourceId: 'cc',
      name: 'Visa',
      date: '2026-10-25',
      daysUntil: 8,
      amount: 350_000,
      urgent: false,
      overdue: false,
    });
  });

  it('el día de pago hoy es urgente; si ya pasó, pasa al mes siguiente', () => {
    expect(upcomingItems(input({ accounts: [card({ paymentDueDay: 17 })], balances: [['cc', -1]] }), TODAY)[0]).toMatchObject({
      daysUntil: 0,
      urgent: true,
      overdue: false,
    });
    expect(upcomingItems(input({ accounts: [card({ paymentDueDay: 1 })], balances: [['cc', -1]] }), TODAY)[0]?.date).toBe('2026-11-01');
  });

  it('excluye sin deuda, con saldo a favor, sin día de pago, archivadas y borradas', () => {
    const cases: [Account, number][] = [
      [card(), 0],
      [card(), 5_000],
      [card({ paymentDueDay: null }), -1_000],
      [card({ isArchived: true }), -1_000],
      [card({ deletedAt: '2026-10-01T00:00:00.000Z' }), -1_000],
    ];
    for (const [account, balance] of cases) {
      expect(upcomingItems(input({ accounts: [account], balances: [['cc', balance]] }), TODAY)).toEqual([]);
    }
  });

  it('ignora cuentas que no son tarjeta aunque tengan día de pago', () => {
    const savings = makeAccount({ id: 'sav', paymentDueDay: 20 });
    expect(upcomingItems(input({ accounts: [savings], balances: [['sav', -1_000]] }), TODAY)).toEqual([]);
  });

  it('la exclusión del patrimonio no afecta los vencimientos', () => {
    const excluded = card({ isExcludedFromNetWorth: true });
    expect(upcomingItems(input({ accounts: [excluded], balances: [['cc', -1_000]] }), TODAY)).toHaveLength(1);
  });
});

describe('upcomingItems: orden', () => {
  it('ordena por fecha; el mismo día: tarjeta, CDT, suscripción y luego nombre', () => {
    const items = upcomingItems(
      input({
        subscriptions: [
          makeSubscription({ id: 'sub-b', name: 'Spotify', billingDay: 25 }),
          makeSubscription({ id: 'sub-a', name: 'Apple', billingDay: 25 }),
          makeSubscription({ id: 'sub-early', name: 'Zeta', billingDay: 18 }),
        ],
        cdts: [makeCdt({ id: 'cdt', maturesOn: '2026-10-25' })],
        accounts: [card()],
        balances: [['cc', -1_000]],
      }),
      TODAY,
    );
    expect(items.map((i) => i.sourceId)).toEqual(['sub-early', 'cc', 'cdt', 'sub-a', 'sub-b']);
  });

  it('mañana es urgente; pasado mañana no', () => {
    const items = upcomingItems(
      input({ subscriptions: [makeSubscription({ id: 'tomorrow', billingDay: 18 }), makeSubscription({ id: 'later', billingDay: 19 })] }),
      TODAY,
    );
    expect(items.map((i) => i.urgent)).toEqual([true, false]);
  });
});

describe('daysUntilLabel', () => {
  it.each([
    [-3, 'Vencido hace 3 días'],
    [-1, 'Vencido ayer'],
    [0, 'Hoy'],
    [1, 'Mañana'],
    [5, 'En 5 días'],
  ])('%p → %p', (days, label) => {
    expect(daysUntilLabel(days)).toBe(label);
  });
});
