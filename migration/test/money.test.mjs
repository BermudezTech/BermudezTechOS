import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MigrationError } from '../lib/errors.mjs';
import { absAmountString, formatCents, parseCents, sumCents } from '../lib/money.mjs';

test('parseCents convierte a centavos exactos', () => {
  assert.equal(parseCents('-133000.00'), -13300000n);
  assert.equal(parseCents('94100.00'), 9410000n);
  assert.equal(parseCents('0.10') + parseCents('0.20'), parseCents('0.30'));
});

test('parseCents rechaza formatos inválidos', () => {
  for (const value of ['1.5', 'abc', '1,00', '', '1.000']) {
    assert.throws(() => parseCents(value), MigrationError, value);
  }
});

test('formatCents usa el formato es-CO', () => {
  assert.equal(formatCents(-13300000n), '-133.000,00');
  assert.equal(formatCents(691n), '6,91');
  assert.equal(formatCents(0n), '0,00');
  assert.equal(formatCents(34480000n), '344.800,00');
  assert.equal(formatCents(-5n), '-0,05');
});

test('absAmountString devuelve el valor absoluto como string', () => {
  assert.equal(absAmountString('-133000.00'), '133000.00');
  assert.equal(absAmountString('6.91'), '6.91');
});

test('sumCents suma sin pérdida', () => {
  assert.equal(sumCents([parseCents('0.10'), parseCents('0.20'), parseCents('-0.30')]), 0n);
});
