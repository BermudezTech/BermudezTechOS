import { cents } from '@/lib/money';

import { balanceEvolution, balanceReport, firstActivityMonth, monthSummary } from './monthSummary';
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

describe('balanceReport', () => {
  it('balance = ingresos − gastos, con las mismas variaciones del resumen', () => {
    const report = balanceReport(txs, october);
    const summary = monthSummary(txs, october);
    expect(report.balance).toBe(report.income - report.expense);
    expect(report.balance).toBe(450_000);
    expect(report.previousBalance).toBe(200_000);
    expect(report.incomeDelta).toEqual(summary.incomeDelta);
    expect(report.expenseDelta).toEqual(summary.expenseDelta);
  });

  it('usa porcentaje si el balance anterior es positivo', () => {
    const delta = balanceReport(txs, october).balanceDelta;
    expect(delta?.kind).toBe('pct');
    expect(delta?.kind === 'pct' && delta.value.toNumber()).toBe(125);
  });

  it('usa la diferencia absoluta si el balance anterior es ≤ 0', () => {
    const deficit = [
      makeTx({ amount: cents(300_000), on: '2026-09-03' }),
      makeTx({ type: 'INCOME', amount: cents(100_000), on: '2026-10-01' }),
    ];
    expect(balanceReport(deficit, october).balanceDelta).toEqual({ kind: 'abs', value: 400_000 });
    expect(balanceReport([makeTx({ type: 'INCOME', amount: cents(5_000), on: '2026-10-01' })], october).balanceDelta).toEqual({
      kind: 'abs',
      value: 5_000,
    });
  });

  it('sin movimientos en ambos periodos no hay variación', () => {
    expect(balanceReport([], october)).toMatchObject({ income: 0, expense: 0, balance: 0, balanceDelta: null });
  });
});

describe('balanceEvolution', () => {
  it('devuelve 6 meses del más antiguo al actual', () => {
    const evo = balanceEvolution(txs, october, 6);
    expect(evo.map((p) => p.period.anchor)).toEqual(['2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01']);
    expect(evo[4]).toMatchObject({ income: 400_000, expense: 200_000, balance: 200_000 });
    expect(evo[5]).toMatchObject({ income: 600_000, expense: 150_000, balance: 450_000 });
  });

  it('funciona por años', () => {
    const evo = balanceEvolution(txs, { granularity: 'YEAR', anchor: '2026-01-01' }, 6);
    expect(evo).toHaveLength(6);
    expect(evo[5]).toMatchObject({ income: 1_000_000, expense: 350_000, balance: 650_000 });
  });
});

describe('firstActivityMonth', () => {
  it('es el mes local del ingreso o gasto personal más antiguo', () => {
    expect(firstActivityMonth(txs)).toBe('2026-09-01');
  });

  it('ignora transferencias, reembolsables y borrados', () => {
    expect(
      firstActivityMonth([
        makeTx({ type: 'TRANSFER', counterAccountId: 'card', on: '2025-01-05' }),
        makeTx({ reimbursementGroupId: 'g1', on: '2025-02-05' }),
        makeTx({ deletedAt: '2026-01-01T00:00:00.000Z', on: '2025-03-05' }),
        makeTx({ on: '2026-04-05' }),
      ]),
    ).toBe('2026-04-01');
  });

  it('sin movimientos devuelve null', () => {
    expect(firstActivityMonth([])).toBeNull();
  });

  it('usa el mes de Bogotá, no el de UTC', () => {
    // 31 de enero 23:30 en Bogotá = 1 de febrero 04:30 UTC.
    expect(firstActivityMonth([makeTx({ occurredAt: '2026-02-01T04:30:00.000Z' })])).toBe('2026-01-01');
  });
});
