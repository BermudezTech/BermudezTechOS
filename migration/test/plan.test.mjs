import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { MigrationError } from '../lib/errors.mjs';
import { parseMovements } from '../lib/parse-dump.mjs';
import { buildPlan, movementId, transferId } from '../lib/plan.mjs';

const fixture = readFileSync(new URL('./fixtures/sample-dump.sql', import.meta.url), 'utf8');
const movements = parseMovements(fixture);
const plan = buildPlan(movements);
const bySource = new Map(plan.transactions.map((t) => [t.sourceIds.join(':'), t]));

const row = (id, amount, date, location, description = `Movimiento ${id}`, cdt = null) => ({
  id,
  description,
  amount,
  date,
  location,
  cdt,
});

test('excluye CDT, USD y montos cero sin abortar por fechas de filas excluidas', () => {
  assert.equal(plan.summary.read, 23);
  assert.equal(plan.summary.included, 19);
  assert.deepEqual(plan.summary.excluded, { CDT: 2, USD: 1, ZERO_AMOUNT: 1 });
  for (const id of [8, 9, 10, 22]) {
    assert.ok(!plan.transactions.some((t) => t.sourceIds.includes(id)), `id ${id}`);
  }
});

test('positivo es ingreso y negativo egreso, con monto absoluto y datos originales', () => {
  assert.deepEqual(bySource.get('1'), {
    id: movementId(1),
    type: 'INCOME',
    accountKey: 'cash',
    counterAccountKey: null,
    amount: '94100.00',
    occurredAt: '2021-07-22T05:00:00.000Z',
    description: 'Ingreso Daniela J',
    sourceIds: [1],
  });
  assert.equal(bySource.get('2').type, 'EXPENSE');
  assert.equal(bySource.get('2').amount, '25000.50');
  assert.equal(bySource.get('2').description, 'Compra mercado ñandú');
});

test('Bolsillo (8) se carga en Efectivo', () => {
  assert.equal(bySource.get('7').accountKey, 'cash');
});

test('un par válido forma una transferencia con la descripción de la salida', () => {
  assert.deepEqual(bySource.get('11:12'), {
    id: transferId(11, 12),
    type: 'TRANSFER',
    accountKey: 'bancolombia',
    counterAccountKey: 'nequi',
    amount: '50000.00',
    occurredAt: '2022-02-01T05:00:00.000Z',
    description: 'Transferencia a Nequi',
    sourceIds: [11, 12],
  });
});

test('un par Efectivo ↔ Bolsillo se descarta por fusión', () => {
  assert.equal(plan.summary.discardedMergedPairs, 1);
  assert.ok(!plan.transactions.some((t) => t.sourceIds.includes(13) || t.sourceIds.includes(14)));
});

test('las patas sin pareja quedan como ingreso o egreso', () => {
  assert.equal(bySource.get('15').type, 'EXPENSE');
  assert.equal(bySource.get('16').type, 'INCOME');
  assert.equal(bySource.get('20').type, 'EXPENSE');
  assert.equal(bySource.get('20').description, 'Transferencia a CDT');
  assert.equal(bySource.get('21').type, 'INCOME');
  assert.equal(plan.summary.candidates, 10);
  assert.equal(plan.summary.looseLegs, 4);
});

test('con dos salidas iguales se empareja la de menor id', () => {
  assert.equal(bySource.get('17:19').type, 'TRANSFER');
  assert.equal(bySource.get('17:19').accountKey, 'nequi');
  assert.equal(bySource.get('17:19').counterAccountKey, 'cash');
  assert.equal(bySource.get('18').type, 'EXPENSE');
});

test('el plan es determinista', () => {
  assert.deepEqual(buildPlan(parseMovements(fixture)), plan);
});

test('cumple los invariantes y los saldos esperados', () => {
  const { summary } = plan;
  assert.equal(summary.read, summary.included + 4);
  assert.equal(summary.transfers, 2);
  assert.equal(
    summary.included,
    2 * summary.transfers + 2 * summary.discardedMergedPairs + summary.incomes + summary.expenses,
  );
  assert.equal(summary.records, 15);
  assert.equal(summary.incomes, 6);
  assert.equal(summary.expenses, 7);
  assert.equal(plan.transactions.length, summary.records);
  assert.deepEqual(
    Object.fromEntries(Object.entries(summary.perAccount).map(([k, v]) => [k, v.expectedCents])),
    {
      cash: -192540000n,
      nequi: 19699950n,
      bancolombia: 95500000n,
      alamano: 0n,
      global66: 3000000n,
    },
  );
});

test('los saldos del plan coinciden con aplicar sus transacciones', () => {
  const balances = Object.fromEntries(Object.keys(plan.summary.perAccount).map((k) => [k, 0n]));
  for (const t of plan.transactions) {
    const cents = BigInt(t.amount.replace('.', ''));
    if (t.type === 'INCOME') balances[t.accountKey] += cents;
    if (t.type === 'EXPENSE') balances[t.accountKey] -= cents;
    if (t.type === 'TRANSFER') {
      balances[t.accountKey] -= cents;
      balances[t.counterAccountKey] += cents;
    }
  }
  for (const [key, { expectedCents }] of Object.entries(plan.summary.perAccount)) {
    assert.equal(balances[key], expectedCents, key);
  }
});

test('una fecha inválida en un movimiento incluido aborta con su id', () => {
  assert.throws(
    () => buildPlan([row(77, '10.00', '0000-00-00', 1)]),
    (error) => error instanceof MigrationError && error.sourceId === 77,
  );
  assert.throws(() => buildPlan([row(78, '10.00', '2025-02-30', 1)]), MigrationError);
});

test('una ubicación desconocida aborta', () => {
  assert.throws(
    () => buildPlan([row(79, '10.00', '2025-01-01', 10)]),
    (error) => error instanceof MigrationError && error.sourceId === 79,
  );
});
