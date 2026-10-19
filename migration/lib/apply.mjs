/**
 * Acceso a PostgreSQL. Todo se ejecuta dentro de la transacción que abre el CLI.
 */
import pg from 'pg';

import { MigrationError } from './errors.mjs';
import { parseCents } from './money.mjs';

export function normalizeDatabaseUrl(url) {
  return url.replace(/^postgresql\+asyncpg:\/\//, 'postgresql://');
}

export async function connect(url) {
  const client = new pg.Client({ connectionString: normalizeDatabaseUrl(url) });
  try {
    await client.connect();
  } catch (error) {
    throw new MigrationError(`No se pudo conectar a la base: ${error.message}`, { exitCode: 2 });
  }
  return client;
}

/** El único usuario de la base nueva recibe todos los registros (FR-002). */
export async function findSingleUser(client) {
  const { rows } = await client.query('SELECT id, email FROM users ORDER BY created_at');
  if (rows.length !== 1) {
    throw new MigrationError(
      `Se esperaba exactamente 1 usuario en la base nueva; hay ${rows.length}`,
      { exitCode: 2 },
    );
  }
  return rows[0];
}

/**
 * Lock exclusivo de sincronización del usuario, el mismo que toma el PUSH
 * (apps/api/app/modules/sync/core/lock.py): espacio 0x53594E43 ("SYNC") y como clave los
 * 4 primeros bytes del UUID en int32 con signo (research R4).
 */
export async function lockUserSync(client, userId) {
  await client.query(
    "SELECT pg_advisory_xact_lock(1398361667, ('x' || substr(replace($1::text, '-', ''), 1, 8))::bit(32)::int)",
    [userId],
  );
}

export async function createAccount(client, userId, account, id) {
  await client.query(
    `INSERT INTO accounts (id, user_id, name, type, nature, currency, opening_balance,
                           is_excluded_from_net_worth, is_archived, sort_order, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'ASSET', 'COP', 0, false, $5, $6, now(), now())`,
    [id, userId, account.name, account.type, account.isArchived, account.sortOrder],
  );
}

export async function loadExistingAccounts(client, userId) {
  const { rows } = await client.query(
    'SELECT id, name, currency, is_archived FROM accounts WHERE user_id = $1 AND deleted_at IS NULL',
    [userId],
  );
  return rows;
}

async function archiveAccount(client, userId, id) {
  await client.query(
    `UPDATE accounts SET is_archived = true, updated_at = now(), server_updated_at = clock_timestamp()
     WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
}

/** Ejecuta las acciones de `resolveAccountActions` y devuelve el mapa `key → id`. */
export async function applyAccountActions(client, userId, actions, accounts) {
  const byKey = new Map(accounts.map((account) => [account.key, account]));
  for (const { key, id, action } of actions) {
    if (action === 'create') await createAccount(client, userId, byKey.get(key), id);
    if (action === 'reuse+archive') await archiveAccount(client, userId, id);
  }
  return Object.fromEntries(actions.map(({ key, id }) => [key, id]));
}

/** Inserta todos los movimientos en una sola sentencia (research R11). Montos como string. */
export async function insertTransactions(client, userId, accountIds, transactions) {
  const columns = [[], [], [], [], [], [], []];
  for (const t of transactions) {
    columns[0].push(t.id);
    columns[1].push(accountIds[t.accountKey]);
    columns[2].push(t.counterAccountKey ? accountIds[t.counterAccountKey] : null);
    columns[3].push(t.type);
    columns[4].push(t.amount);
    columns[5].push(t.occurredAt);
    columns[6].push(t.description);
  }
  const { rows } = await client.query(
    `INSERT INTO transactions (id, user_id, account_id, counter_account_id, type, amount, category_id,
                               category_source, occurred_at, description, created_at, updated_at)
     SELECT t.id, $1, t.account_id, t.counter_account_id, t.type, t.amount::numeric, NULL,
            'MANUAL', t.occurred_at, t.description, now(), now()
     FROM unnest($2::uuid[], $3::uuid[], $4::uuid[], $5::text[], $6::text[], $7::timestamptz[], $8::text[])
          AS t(id, account_id, counter_account_id, type, amount, occurred_at, description)
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    [userId, ...columns],
  );
  return { inserted: rows.length, existing: transactions.length - rows.length };
}

/**
 * Saldo de cada cuenta en la base, solo con los movimientos de la migración, comparado al centavo
 * con el esperado del dump. Un descuadre lanza error y fuerza el ROLLBACK (research R5).
 */
export async function verifyBalances(client, userId, accountIds, transactionIds, perAccount) {
  const { rows } = await client.query(
    `SELECT a.key,
            COALESCE(SUM(CASE
              WHEN t.type = 'INCOME' AND t.account_id = a.id THEN t.amount
              WHEN t.type IN ('EXPENSE', 'TRANSFER') AND t.account_id = a.id THEN -t.amount
              WHEN t.type = 'TRANSFER' AND t.counter_account_id = a.id THEN t.amount
              ELSE 0 END), 0)::numeric(14, 2)::text AS balance
     FROM unnest($2::text[], $3::uuid[]) AS a(key, id)
     LEFT JOIN transactions t
       ON t.user_id = $1 AND t.id = ANY($4::uuid[]) AND (t.account_id = a.id OR t.counter_account_id = a.id)
     GROUP BY a.key`,
    [userId, Object.keys(accountIds), Object.values(accountIds), transactionIds],
  );
  const actual = new Map(rows.map((row) => [row.key, parseCents(row.balance)]));
  const verification = Object.entries(perAccount).map(([key, { expectedCents }]) => {
    const actualCents = actual.get(key) ?? 0n;
    return { key, expectedCents, actualCents, ok: actualCents === expectedCents };
  });
  return verification;
}
