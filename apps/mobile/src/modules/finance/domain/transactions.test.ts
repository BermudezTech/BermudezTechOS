import { cents } from '@/lib/money';

import { transactionFormSchema } from './schemas/transaction';
import { makeCategory, makeTx } from './testUtils';
import { filterTransactions, groupByLocalDay, periodTotal } from './transactions';

const food = makeCategory({ id: 'food', kind: 'EXPENSE' });
const salary = makeCategory({ id: 'salary', kind: 'INCOME' });
const categories = new Map([food, salary].map((c) => [c.id, c]));

const txs = [
  makeTx({
    id: 't1',
    accountId: 'a',
    type: 'EXPENSE',
    amount: cents(10_000),
    categoryId: 'food',
    description: 'Café Juan Valdez',
    on: '2026-10-15',
  }),
  makeTx({
    id: 't2',
    accountId: 'b',
    type: 'INCOME',
    amount: cents(50_000),
    categoryId: 'salary',
    description: 'Nómina',
    on: '2026-10-15',
  }),
  makeTx({ id: 't3', accountId: 'a', counterAccountId: 'b', type: 'TRANSFER', amount: cents(5_000), on: '2026-10-14' }),
  makeTx({ id: 't4', accountId: 'a', type: 'EXPENSE', amount: cents(2_000), description: 'Pago QR', on: '2026-10-01' }),
];

describe('filterTransactions', () => {
  it('combina filtros', () => {
    expect(filterTransactions(txs, { accountId: 'a', type: 'EXPENSE' }).map((t) => t.id)).toEqual(['t1', 't4']);
    expect(filterTransactions(txs, { accountId: 'b' }).map((t) => t.id)).toEqual(['t2', 't3']);
    expect(filterTransactions(txs, { categoryId: 'NONE' }).map((t) => t.id)).toEqual(['t4']);
    expect(filterTransactions(txs, { from: '2026-10-14', to: '2026-10-14' }).map((t) => t.id)).toEqual(['t3']);
  });

  it('busca sin distinguir mayúsculas ni acentos', () => {
    expect(filterTransactions(txs, { search: 'cafe' }).map((t) => t.id)).toEqual(['t1']);
    expect(filterTransactions(txs, { search: 'NÓMINA' }).map((t) => t.id)).toEqual(['t2']);
  });
});

describe('agrupación y totales', () => {
  it('agrupa por día local en orden descendente', () => {
    const groups = groupByLocalDay(txs);
    expect(groups.map((g) => g.day)).toEqual(['2026-10-15', '2026-10-14', '2026-10-01']);
    expect(groups[0]?.net).toBe(40_000);
  });

  it('el total excluye transferencias', () => {
    expect(periodTotal(txs)).toEqual({ income: 50_000, expense: 12_000, net: 38_000 });
  });

  it('un movimiento a las 23:30 local va en su día local', () => {
    const late = makeTx({ occurredAt: '2026-11-01T04:30:00.000Z' }); // 31 oct 23:30 en Bogotá
    expect(groupByLocalDay([late])[0]?.day).toBe('2026-10-31');
  });
});

describe('transactionFormSchema', () => {
  const schema = transactionFormSchema(categories);
  const base = {
    type: 'EXPENSE' as const,
    amount: '25000,50',
    accountId: 'a',
    counterAccountId: null,
    categoryId: 'food',
    date: '2026-10-17',
    description: '',
    reimbursementGroupId: null,
  };

  it('acepta un egreso válido y convierte a centavos', () => {
    const r = schema.safeParse(base);
    expect(r.success && r.data.amount).toBe(2_500_050);
  });

  it.each(['0', '-5', '10,555', ''])('rechaza el monto %p', (amount) => {
    const r = schema.safeParse({ ...base, amount });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['amount']);
  });

  it('rechaza transferencias a la misma cuenta', () => {
    const r = schema.safeParse({ ...base, type: 'TRANSFER', categoryId: null, counterAccountId: 'a' });
    expect(r.error?.issues.map((i) => i.message)).toContain('La cuenta destino debe ser distinta de la de origen.');
  });

  it('rechaza una categoría de ingreso en un egreso', () => {
    const r = schema.safeParse({ ...base, categoryId: 'salary' });
    expect(r.error?.issues[0]?.path).toEqual(['categoryId']);
  });
});
