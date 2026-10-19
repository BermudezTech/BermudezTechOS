#!/usr/bin/env node
/**
 * Migra los movimientos en COP de la base antigua (dump MySQL) a la base nueva.
 * Spec: specs/005-legacy-movements-migration. Contrato: contracts/cli.md.
 *
 *   node migrate-legacy-movements.mjs <dump.sql>            simulación (ROLLBACK)
 *   node migrate-legacy-movements.mjs <dump.sql> --apply    aplica (COMMIT)
 *   node migrate-legacy-movements.mjs <dump.sql> --offline  solo planifica, sin base
 */
import { readFile } from 'node:fs/promises';

import {
  applyAccountActions,
  connect,
  findSingleUser,
  insertTransactions,
  loadExistingAccounts,
  lockUserSync,
  verifyBalances,
} from './lib/apply.mjs';
import { MigrationError } from './lib/errors.mjs';
import { parseMovements } from './lib/parse-dump.mjs';
import { ACCOUNTS, buildPlan, resolveAccountActions } from './lib/plan.mjs';
import { formatSummary } from './lib/report.mjs';

const USAGE = 'Uso: node migrate-legacy-movements.mjs <dump.sql> [--apply | --offline]';

function parseArgs(argv) {
  const flags = argv.filter((arg) => arg.startsWith('--'));
  const positional = argv.filter((arg) => !arg.startsWith('--'));
  const unknown = flags.filter((flag) => flag !== '--apply' && flag !== '--offline');
  if (positional.length !== 1 || unknown.length > 0 || flags.length > 1) {
    throw new MigrationError(USAGE, { exitCode: 2 });
  }
  const mode = flags[0] === '--apply' ? 'apply' : flags[0] === '--offline' ? 'offline' : 'dry';
  return { dumpPath: positional[0], mode };
}

async function readDump(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    throw new MigrationError(`No se pudo leer el dump: ${error.message}`, { exitCode: 2 });
  }
}

async function migrate(client, plan, mode) {
  let open = false;
  try {
    await client.query('BEGIN');
    open = true;
    const user = await findSingleUser(client);
    await lockUserSync(client, user.id);

    const accountActions = resolveAccountActions(await loadExistingAccounts(client, user.id), ACCOUNTS);
    const accountIds = await applyAccountActions(client, user.id, accountActions, ACCOUNTS);
    const write = await insertTransactions(client, user.id, accountIds, plan.transactions);
    const verification = await verifyBalances(
      client,
      user.id,
      accountIds,
      plan.transactions.map((t) => t.id),
      plan.summary.perAccount,
    );
    const report = formatSummary({ mode, user, summary: plan.summary, accountActions, write, verification });

    if (verification.some((v) => !v.ok)) {
      console.error(report);
      throw new MigrationError('Los saldos en la base no coinciden con los del dump');
    }
    await client.query(mode === 'apply' ? 'COMMIT' : 'ROLLBACK');
    open = false;
    console.log(report);
  } finally {
    if (open) await client.query('ROLLBACK');
  }
}

async function main() {
  const { dumpPath, mode } = parseArgs(process.argv.slice(2));
  const url = mode === 'offline' ? null : (process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL);
  if (mode !== 'offline' && !url) {
    throw new MigrationError('Falta MIGRATION_DATABASE_URL (o DATABASE_URL)', { exitCode: 2 });
  }

  const plan = buildPlan(parseMovements(await readDump(dumpPath)));
  if (mode === 'offline') {
    console.log(formatSummary({ mode, summary: plan.summary }));
    return;
  }

  const client = await connect(url);
  try {
    await migrate(client, plan, mode);
  } catch (error) {
    console.error('No se escribió ningún cambio.');
    throw error;
  } finally {
    await client.end();
  }
}

try {
  await main();
} catch (error) {
  if (error instanceof MigrationError) {
    const source = error.sourceId === undefined ? '' : ` (movimiento ${error.sourceId})`;
    console.error(`Error: ${error.message}${source}`);
    process.exitCode = error.exitCode;
  } else {
    console.error(error);
    process.exitCode = 1;
  }
}
