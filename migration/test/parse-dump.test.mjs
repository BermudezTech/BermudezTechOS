import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { MigrationError } from '../lib/errors.mjs';
import { parseMovements } from '../lib/parse-dump.mjs';

const fixture = readFileSync(new URL('./fixtures/sample-dump.sql', import.meta.url), 'utf8');

test('devuelve solo las filas de movements', () => {
  const movements = parseMovements(fixture);
  assert.equal(movements.length, 23);
  assert.deepEqual(movements[0], {
    id: 1,
    description: 'Ingreso Daniela J',
    amount: '94100.00',
    date: '2021-07-22',
    location: 1,
    cdt: null,
  });
  assert.deepEqual(
    movements.find((m) => m.id === 8),
    {
      id: 8,
      description: 'CDT Bancamia Iniciado',
      amount: '3000000.00',
      date: '0000-00-00',
      location: 3,
      cdt: 1,
    },
  );
});

test('conserva tildes y ñ, y tolera CRLF y espacios finales', () => {
  assert.ok(fixture.includes('\r\n'), 'el fixture debe tener una línea CRLF');
  const byId = new Map(parseMovements(fixture).map((m) => [m.id, m]));
  assert.equal(byId.get(2).description, 'Compra mercado ñandú');
  assert.equal(byId.get(2).amount, '-25000.50');
  assert.equal(byId.get(3).description, 'Pago nómina');
  assert.equal(byId.get(23).description, 'Café');
});

test('una línea de movements malformada aborta con su número de línea', () => {
  const broken = `${fixture}\nINSERT INTO movements (\`id\`) VALUES ('99', 'roto');\n`;
  const lineNumber = broken.split(/\r?\n/).length - 1;
  assert.throws(
    () => parseMovements(broken),
    (error) =>
      error instanceof MigrationError &&
      error.exitCode === 1 &&
      error.message.includes(`línea ${lineNumber}`),
  );
});
