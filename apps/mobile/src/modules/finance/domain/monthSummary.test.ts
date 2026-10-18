import { cents } from '@/lib/money';

import { monthSummary } from './monthSummary';
import { makeTx } from './testUtils';

const october = { granularity: 'MONTH' as const, anchor: '2026-10-01' };

const txs = [
  makeTx({ type: 'INCOME', amount: cents(500_000), on: '2026-10-01' }),
  makeTx({ type: 'INCOME', amount: cents(100_000), on: '2026-10-15' }),
  makeTx({ amount: cents(150_000), on: '2026-10-03' }),
  makeTx({ type: 'INCOME', amount: cents(400_000), on: '2026-09-01' }),
  makeTx({ amount: cents(200_000), on: '2026-09-03' }),
  // Excluidos: transferencia y movimientos de grupos de reembolso.
  makeTx({ type: 'TRANSFER', counterAccountId: 'card', amount: cents(999_000), on: '2026-10-10' }),
  makeTx({ type: 'INCOME', amount: cents(888_000), reimbursementGroupId: 'g1', on: '2026-10-11' }),
  makeTx({ amount: cents(777_000), reimbursementGroupId: 'g1', on: '2026-10-12' }),
];

describe('monthSummary', () => {
  const summary = monthSummary(txs, october);

  it('suma ingresos y gastos personales, sin transferencias ni reembolsos', () => {
    expect(summary.income).toBe(600_000);
    expect(summary.expense).toBe(150_000);
  });

  it('calcula el balance como ingresos − gastos', () => {
    expect(summary.balance).toBe(450_000);
  });

  it('compara con el mes anterior', () => {
    expect(summary.incomeDelta?.toString()).toBe('50');
    expect(summary.expenseDelta?.toString()).toBe('-25');
  });

  it('da balance negativo si se gasta más de lo que entra', () => {
    const s = monthSummary([makeTx({ amount: cents(10_000), on: '2026-10-02' })], october);
    expect(s.balance).toBe(-10_000);
  });
});
