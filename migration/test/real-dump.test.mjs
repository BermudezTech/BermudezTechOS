import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import { parseMovements } from '../lib/parse-dump.mjs';
import { buildPlan } from '../lib/plan.mjs';

// El dump real está fuera de git (migration/.gitignore): la prueba se omite si no está.
const dump = new URL('../bermudezwebapp-17-Saturday-October-2026.sql', import.meta.url);

test('cifras esperadas con el dump del 17-10-2026', { skip: !existsSync(dump) && 'dump no presente' }, () => {
  const { summary, transactions } = buildPlan(parseMovements(readFileSync(dump, 'utf8')));
  assert.equal(summary.read, 2149);
  assert.equal(summary.included, 2137);
  assert.deepEqual(summary.excluded, { CDT: 12, USD: 0, ZERO_AMOUNT: 0 });
  assert.equal(summary.transfers, 201);
  assert.equal(summary.discardedMergedPairs, 7);
  assert.equal(summary.records, 1922);
  assert.equal(summary.incomes + summary.expenses, 1721);
  assert.equal(transactions.length, 1922);
  assert.equal(new Set(transactions.map((t) => t.id)).size, 1922);
  assert.deepEqual(
    Object.fromEntries(Object.entries(summary.perAccount).map(([k, v]) => [k, v.expectedCents])),
    { cash: 34480000n, nequi: 691n, bancolombia: 20000079n, alamano: 0n, global66: 0n },
  );
});
