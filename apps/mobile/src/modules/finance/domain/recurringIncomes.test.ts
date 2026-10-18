import { cents } from '@/lib/money';

import { hasEntryInPeriod, periodFor, prefillFrom } from './recurringIncomes';
import { makeTx } from './testUtils';
import type { RecurringIncome } from './types';

const salary: RecurringIncome = {
  id: 'ri',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  deletedAt: null,
  accountId: 'acc',
  categoryId: 'cat-salary',
  name: 'Salario',
  icon: null,
  expectedAmount: cents(500_000_000),
  cycle: 'MONTHLY',
  expectedDay: 30,
  expectedMonth: null,
  startDate: '2026-01-01',
  status: 'ACTIVE',
};

describe('periodFor', () => {
  it('usa YYYY-MM en mensuales y YYYY en anuales', () => {
    expect(periodFor('MONTHLY', '2026-10-17')).toBe('2026-10');
    expect(periodFor('YEARLY', '2026-10-17')).toBe('2026');
  });
});

describe('hasEntryInPeriod', () => {
  const linked = makeTx({ id: 'a', type: 'INCOME', recurringIncomeId: 'ri', recurringIncomePeriod: '2026-10' });
  const deleted = makeTx({
    type: 'INCOME',
    recurringIncomeId: 'ri',
    recurringIncomePeriod: '2026-09',
    deletedAt: '2026-09-30T00:00:00.000Z',
  });

  it('detecta un ingreso del mismo periodo', () => {
    expect(hasEntryInPeriod([linked], 'ri', '2026-10')).toBe(true);
    expect(hasEntryInPeriod([linked], 'ri', '2026-11')).toBe(false);
  });

  it('ignora borrados y el movimiento que se edita', () => {
    expect(hasEntryInPeriod([deleted], 'ri', '2026-09')).toBe(false);
    expect(hasEntryInPeriod([linked], 'ri', '2026-10', 'a')).toBe(false);
  });
});

describe('prefillFrom', () => {
  it('copia valor esperado, cuenta, categoría y nombre, con la fecha de hoy', () => {
    expect(prefillFrom(salary, '2026-10-17')).toEqual({
      amount: 500_000_000,
      accountId: 'acc',
      categoryId: 'cat-salary',
      description: 'Salario',
      date: '2026-10-17',
    });
  });
});
