import { cents } from '@/lib/money';

import { monthSummary } from './monthSummary';
import {
  categoryFlowEvolution,
  categoryFlowReport,
  categoryFlowTransactions,
  categoryTransactions,
  spendingEvolution,
  spendingReport,
} from './spending';
import { makeCategory, makeTx } from './testUtils';

const food = makeCategory({ id: 'food', name: 'Alimentación' });
const fun = makeCategory({ id: 'fun', name: 'Entretenimiento' });
const categories = new Map([food, fun].map((c) => [c.id, c]));
const october = { granularity: 'MONTH' as const, anchor: '2026-10-01' };

const txs = [
  makeTx({ categoryId: 'food', amount: cents(30_000), on: '2026-10-05' }),
  makeTx({ categoryId: 'food', amount: cents(10_000), on: '2026-10-20' }),
  makeTx({ categoryId: 'fun', amount: cents(20_000), on: '2026-10-07' }),
  makeTx({ categoryId: null, amount: cents(5_000), on: '2026-10-08' }),
  makeTx({ categoryId: 'food', amount: cents(20_000), on: '2026-09-10' }),
  // Excluidos: transferencia (pago de tarjeta), egreso de grupo de reembolso e ingreso.
  makeTx({ type: 'TRANSFER', counterAccountId: 'card', amount: cents(999_000), on: '2026-10-10' }),
  makeTx({ categoryId: 'food', amount: cents(888_000), reimbursementGroupId: 'g1', on: '2026-10-11' }),
  makeTx({ type: 'INCOME', amount: cents(777_000), on: '2026-10-12' }),
];

describe('spendingReport', () => {
  const report = spendingReport(txs, categories, october);

  it('excluye transferencias, pagos de tarjeta y egresos de grupos', () => {
    expect(report.total).toBe(65_000);
    expect(report.previousTotal).toBe(20_000);
  });

  it('agrupa por categoría, ordena y calcula porcentajes', () => {
    expect(report.items.map((i) => [i.name, i.amount])).toEqual([
      ['Alimentación', 40_000],
      ['Entretenimiento', 20_000],
      ['Sin categoría', 5_000],
    ]);
    const pctSum = report.items.reduce((acc, i) => acc + i.pct.toNumber(), 0);
    expect(pctSum).toBeCloseTo(100, 6);
  });

  it('calcula la variación frente al periodo anterior', () => {
    expect(report.items[0]?.delta).not.toBe('new');
    expect((report.items[0]?.delta as { toNumber(): number }).toNumber()).toBe(100);
    expect(report.items[1]?.delta).toBe('new');
    expect((report.delta as { toNumber(): number }).toNumber()).toBe(225);
  });

  it('funciona en modo año', () => {
    expect(spendingReport(txs, categories, { granularity: 'YEAR', anchor: '2026-01-01' }).total).toBe(85_000);
  });
});

describe('spendingEvolution y categoryTransactions', () => {
  it('devuelve 6 periodos terminando en el actual', () => {
    const evo = spendingEvolution(txs, october, 6);
    expect(evo.map((p) => p.period.anchor)).toEqual(['2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01']);
    expect(evo.map((p) => p.total)).toEqual([0, 0, 0, 0, 20_000, 65_000]);
  });

  it('lista movimientos de una categoría (o sin categoría)', () => {
    expect(categoryTransactions(txs, 'food', october).map((t) => t.amount)).toEqual([10_000, 30_000]);
    expect(categoryTransactions(txs, null, october)).toHaveLength(1);
  });
});

describe('categoryFlowReport (ingresos)', () => {
  const salary = makeCategory({ id: 'salary', name: 'Salario', kind: 'INCOME' });
  const extra = makeCategory({ id: 'extra', name: 'Extras', kind: 'INCOME' });
  const incomeCategories = new Map([salary, extra].map((c) => [c.id, c]));
  const incomes = [
    makeTx({ type: 'INCOME', categoryId: 'salary', amount: cents(500_000), on: '2026-10-01' }),
    makeTx({ type: 'INCOME', categoryId: 'extra', amount: cents(100_000), on: '2026-10-15' }),
    makeTx({ type: 'INCOME', categoryId: null, amount: cents(50_000), on: '2026-10-20' }),
    makeTx({ type: 'INCOME', categoryId: 'salary', amount: cents(400_000), on: '2026-09-01' }),
    // Excluidos: transferencia, ingreso de grupo de reembolso y un egreso.
    makeTx({ type: 'TRANSFER', counterAccountId: 'card', amount: cents(999_000), on: '2026-10-10' }),
    makeTx({ type: 'INCOME', categoryId: 'extra', amount: cents(888_000), reimbursementGroupId: 'g1', on: '2026-10-11' }),
    makeTx({ categoryId: 'food', amount: cents(30_000), on: '2026-10-05' }),
  ];
  const report = categoryFlowReport(incomes, incomeCategories, october, 'INCOME');

  it('agrupa ingresos personales por categoría, con "Sin categoría"', () => {
    expect(report.kind).toBe('INCOME');
    expect(report.total).toBe(650_000);
    expect(report.previousTotal).toBe(400_000);
    expect(report.items.map((i) => [i.name, i.amount])).toEqual([
      ['Salario', 500_000],
      ['Extras', 100_000],
      ['Sin categoría', 50_000],
    ]);
    expect(report.items.reduce((acc, i) => acc + i.pct.toNumber(), 0)).toBeCloseTo(100, 6);
  });

  it('calcula la variación por categoría', () => {
    expect((report.items[0]?.delta as { toNumber(): number }).toNumber()).toBe(25);
    expect(report.items[1]?.delta).toBe('new');
  });

  it('evolución de 6 periodos y movimientos de una categoría', () => {
    expect(categoryFlowEvolution(incomes, october, 'INCOME', 6).map((p) => p.total)).toEqual([0, 0, 0, 0, 400_000, 650_000]);
    expect(categoryFlowTransactions(incomes, 'salary', october, 'INCOME').map((t) => t.amount)).toEqual([500_000]);
    expect(categoryFlowTransactions(incomes, null, october, 'INCOME').map((t) => t.amount)).toEqual([50_000]);
  });

  it.each([
    { granularity: 'MONTH' as const, anchor: '2026-10-01' },
    { granularity: 'MONTH' as const, anchor: '2026-09-01' },
    { granularity: 'YEAR' as const, anchor: '2026-01-01' },
  ])('coincide con el resumen del periodo (SC-002) — %o', (period) => {
    const all = [...txs, ...incomes];
    const summary = monthSummary(all, period);
    const allCategories = new Map([...categories, ...incomeCategories]);
    expect(categoryFlowReport(all, allCategories, period, 'INCOME').total).toBe(summary.income);
    expect(categoryFlowReport(all, allCategories, period, 'EXPENSE').total).toBe(summary.expense);
  });
});
