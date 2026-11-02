import { allColumns, SYNC_TABLES, type ColumnKind, type SyncTable } from '@/sync/tables';

import type { SqlDatabase } from './types';

/** Tipo SQLite por tipo de columna: montos en centavos enteros, tasas como texto, nunca REAL. */
const SQL_TYPE: Record<ColumnKind, 'TEXT' | 'INTEGER'> = {
  text: 'TEXT',
  int: 'INTEGER',
  bool: 'INTEGER',
  money: 'INTEGER',
  rate: 'TEXT',
  date: 'TEXT',
  datetime: 'TEXT',
};

/** Sin `user_id` ni `FOREIGN KEY` locales (data-model §1). */
function createTable(table: SyncTable): string {
  const columns = allColumns(table).map((c) => {
    if (c.column === 'id') return 'id TEXT PRIMARY KEY';
    return `${c.column} ${SQL_TYPE[c.kind]}${c.nullable ? ' NULL' : ' NOT NULL'}`;
  });
  columns.push('server_updated_at TEXT NULL', 'is_dirty INTEGER NOT NULL DEFAULT 0');
  return `CREATE TABLE ${table} (\n  ${columns.join(',\n  ')}\n);\nCREATE INDEX idx_${table}_dirty ON ${table}(id) WHERE is_dirty = 1;`;
}

const migration1 = [
  ...SYNC_TABLES.map(createTable),
  `CREATE TABLE sync_metadata (
  table_name TEXT PRIMARY KEY,
  pull_cursor TEXT NULL,
  last_synced_at TEXT NULL
);`,
  ...SYNC_TABLES.map((t) => `INSERT INTO sync_metadata (table_name) VALUES ('${t}');`),
  `CREATE TABLE sync_rejections (
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  code TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_updated_at TEXT NULL,
  rejected_at TEXT NOT NULL,
  PRIMARY KEY (table_name, record_id)
);`,
].join('\n');

/** Columnas de `cdts` en la versión 1 (antes de spec 009). No cambiar: las usa la migración 2. */
const CDTS_V1_COLUMNS = [
  'id',
  'created_at',
  'updated_at',
  'deleted_at',
  'account_id',
  'issuer',
  'certificate_number',
  'principal',
  'annual_rate_ea',
  'annual_rate_nominal',
  'term_days',
  'opened_on',
  'matures_on',
  'interest_payment',
  'withholding_rate',
  'source_account_id',
  'payout_account_id',
  'status',
  'renewed_from_cdt_id',
  'server_updated_at',
  'is_dirty',
].join(', ');

/**
 * Spec 009: `source_account_id` admite NULL y se añaden el override del valor final y la
 * liquidación. SQLite no altera `NOT NULL`, así que se reconstruye la tabla. `migration1` se
 * genera con el esquema actual, de modo que en instalaciones nuevas la copia también funciona.
 */
const migration2 = [
  'DROP INDEX IF EXISTS idx_cdts_dirty;',
  createTable('cdts')
    .replace('CREATE TABLE cdts (', 'CREATE TABLE cdts_new (')
    .replace(/\nCREATE INDEX[^\n]*$/, ''),
  `INSERT INTO cdts_new (${CDTS_V1_COLUMNS}) SELECT ${CDTS_V1_COLUMNS} FROM cdts;`,
  'DROP TABLE cdts;',
  'ALTER TABLE cdts_new RENAME TO cdts;',
  'CREATE INDEX idx_cdts_dirty ON cdts(id) WHERE is_dirty = 1;',
].join('\n');

/** Migraciones versionadas (FR-010): la versión aplicada vive en `PRAGMA user_version`. Solo se añaden al final. */
export const MIGRATIONS: string[] = [migration1, migration2];

export async function migrate(db: SqlDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (let version = current + 1; version <= MIGRATIONS.length; version++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version - 1]!);
      await db.execAsync(`PRAGMA user_version = ${version}`);
    });
  }
}
