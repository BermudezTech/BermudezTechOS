import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MigrationError } from '../lib/errors.mjs';
import { ACCOUNTS, accountId, resolveAccountActions } from '../lib/plan.mjs';

const existing = (id, name, { currency = 'COP', is_archived = false } = {}) => ({
  id,
  name,
  currency,
  is_archived,
});

const byKey = (actions) => Object.fromEntries(actions.map((a) => [a.key, a]));

test('sin coincidencias crea todas las cuentas con su ID determinista', () => {
  const actions = resolveAccountActions([], ACCOUNTS);
  assert.deepEqual(
    actions.map((a) => [a.key, a.action, a.id]),
    ACCOUNTS.map(({ key }) => [key, 'create', accountId(key)]),
  );
});

test('reutiliza por nombre sin distinguir mayúsculas ni espacios', () => {
  const actions = byKey(resolveAccountActions([existing('n-1', ' nequi ')], ACCOUNTS));
  assert.deepEqual(actions.nequi, { key: 'nequi', id: 'n-1', action: 'reuse' });
  assert.equal(actions.cash.action, 'create');
});

test('archiva las cuentas reutilizadas que deben quedar archivadas', () => {
  const actions = byKey(
    resolveAccountActions(
      [existing('g-1', 'Global66'), existing('a-1', 'A LA MANO', { is_archived: true })],
      ACCOUNTS,
    ),
  );
  assert.equal(actions.global66.action, 'reuse+archive');
  assert.equal(actions.alamano.action, 'reuse');
});

test('nunca desarchiva una cuenta activa reutilizada que ya estaba archivada', () => {
  const actions = byKey(
    resolveAccountActions([existing('e-1', 'Efectivo', { is_archived: true })], ACCOUNTS),
  );
  assert.equal(actions.cash.action, 'reuse');
});

test('aborta si el nombre es ambiguo', () => {
  assert.throws(
    () => resolveAccountActions([existing('1', 'Nequi'), existing('2', 'NEQUI')], ACCOUNTS),
    (error) => error instanceof MigrationError && /ambigua/.test(error.message),
  );
});

test('aborta si la cuenta existente no es COP', () => {
  assert.throws(
    () => resolveAccountActions([existing('1', 'Bancolombia', { currency: 'USD' })], ACCOUNTS),
    MigrationError,
  );
});

test('ignora una cuenta existente llamada Bolsillo', () => {
  const actions = resolveAccountActions([existing('b-1', 'Bolsillo')], ACCOUNTS);
  assert.ok(actions.every((a) => a.id !== 'b-1'));
  assert.equal(actions.length, ACCOUNTS.length);
});
