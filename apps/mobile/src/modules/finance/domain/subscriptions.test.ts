import { cents } from '@/lib/money';

import { canTransition, monthlyEquivalent, nextBillingDate } from './subscriptions';
import { makeSubscription } from './testUtils';

describe('nextBillingDate', () => {
  const monthly31 = makeSubscription({ billingDay: 31, startDate: '2025-01-01' });

  it('ajusta el día 31 al último día de febrero y abril', () => {
    expect(nextBillingDate(monthly31, '2026-02-10')).toBe('2026-02-28');
    expect(nextBillingDate(monthly31, '2026-04-05')).toBe('2026-04-30');
    expect(nextBillingDate(monthly31, '2026-03-31')).toBe('2026-03-31');
  });

  it('pasa al mes siguiente si el día ya pasó', () => {
    expect(nextBillingDate(makeSubscription({ billingDay: 5 }), '2026-10-17')).toBe('2026-11-05');
    expect(nextBillingDate(makeSubscription({ billingDay: 5 }), '2026-12-17')).toBe('2027-01-05');
  });

  it('anual: usa el año siguiente si el mes ya pasó', () => {
    const yearly = makeSubscription({ billingCycle: 'YEARLY', billingMonth: 6, billingDay: 20 });
    expect(nextBillingDate(yearly, '2026-10-17')).toBe('2027-06-20');
    expect(nextBillingDate(yearly, '2026-03-01')).toBe('2026-06-20');
  });

  it('no cobra antes de la fecha de inicio', () => {
    expect(nextBillingDate(makeSubscription({ billingDay: 1, startDate: '2027-02-15' }), '2026-10-17')).toBe('2027-03-01');
  });
});

describe('monthlyEquivalent', () => {
  it('suma activas con las anuales prorrateadas y redondeo half-up', () => {
    const subs = [
      makeSubscription({ amount: cents(4_490_000) }),
      makeSubscription({ billingCycle: 'YEARLY', billingMonth: 1, amount: cents(11_990_000) }),
      makeSubscription({ amount: cents(12_000_000), status: 'PAUSED' }),
      makeSubscription({ amount: cents(5_000_000), status: 'CANCELLED' }),
    ];
    // 44.900 + 119.900 / 12 = 54.891,666… → 54.891,67
    expect(monthlyEquivalent(subs)).toBe(5_489_167);
  });
});

describe('canTransition', () => {
  it('permite pausar, reanudar y cancelar; cancelada es final', () => {
    expect(canTransition('ACTIVE', 'PAUSED')).toBe(true);
    expect(canTransition('PAUSED', 'ACTIVE')).toBe(true);
    expect(canTransition('PAUSED', 'CANCELLED')).toBe(true);
    expect(canTransition('CANCELLED', 'ACTIVE')).toBe(false);
    expect(canTransition('ACTIVE', 'ACTIVE')).toBe(false);
  });
});
