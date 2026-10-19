import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const cwd = new URL('..', import.meta.url);
const run = (args, env = {}) =>
  spawnSync(process.execPath, ['migrate-legacy-movements.mjs', ...args], {
    cwd,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, ...env },
  });

test('argumentos inválidos terminan con código 2 y el uso', () => {
  for (const args of [[], ['test/fixtures/sample-dump.sql', '--apply', '--offline'], ['a.sql', '--x']]) {
    const result = run(args);
    assert.equal(result.status, 2, args.join(' '));
    assert.match(result.stderr, /Uso:/);
  }
});

test('--offline planifica sin conectar a la base', () => {
  const result = run(['test/fixtures/sample-dump.sql', '--offline']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /OFFLINE/);
  assert.match(result.stdout, /Leídos: 23/);
  assert.match(result.stdout, /Formadas: 2/);
  assert.match(result.stdout, /Registros a migrar: 15/);
  assert.match(result.stdout, /Efectivo: 6 movimientos · saldo -1\.925\.400,00/);
  assert.doesNotMatch(result.stdout, /Usuario/);
});

test('sin URL de base y sin --offline termina con código 2', () => {
  const result = run(['test/fixtures/sample-dump.sql']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /MIGRATION_DATABASE_URL/);
});

test('un dump inexistente termina con código 2', () => {
  const result = run(['no-existe.sql', '--offline']);
  assert.equal(result.status, 2);
});
