import { SYNC_TABLES } from '@/sync/tables';

import { migrate, MIGRATIONS } from './schema';
import { createTestDb } from './testing/betterSqlite';

describe('migrate', () => {
  it('crea las 10 tablas, las filas de sync_metadata y fija user_version', async () => {
    const db = createTestDb();
    await migrate(db);
    const tables = await db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name");
    expect(tables.map((t) => t.name).sort()).toEqual([...SYNC_TABLES, 'sync_metadata', 'sync_rejections'].sort());
    const meta = await db.getAllAsync<{ table_name: string; pull_cursor: string | null }>('SELECT * FROM sync_metadata');
    expect(meta).toHaveLength(8);
    expect(meta.every((m) => m.pull_cursor === null)).toBe(true);
    expect(await db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: MIGRATIONS.length });
  });

  it('es idempotente', async () => {
    const db = createTestDb();
    await migrate(db);
    await migrate(db);
    expect(await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM sync_metadata')).toEqual({ n: 8 });
  });

  it('no guarda user_id, usa INTEGER para montos y nunca REAL', async () => {
    const db = createTestDb();
    await migrate(db);
    for (const table of SYNC_TABLES) {
      const info = await db.getAllAsync<{ name: string; type: string }>(`PRAGMA table_info(${table})`);
      expect(info.map((c) => c.name)).not.toContain('user_id');
      expect(info.map((c) => c.type)).not.toContain('REAL');
      expect(info.find((c) => c.name === 'is_dirty')?.type).toBe('INTEGER');
    }
    const tx = await db.getAllAsync<{ name: string; type: string }>('PRAGMA table_info(transactions)');
    expect(tx.find((c) => c.name === 'amount')?.type).toBe('INTEGER');
    const cdt = await db.getAllAsync<{ name: string; type: string }>('PRAGMA table_info(cdts)');
    expect(cdt.find((c) => c.name === 'annual_rate_ea')?.type).toBe('TEXT');
  });

  it('migración 2: conserva los CDTs de la v1 y admite CDTs sin cuenta de origen (spec 009)', async () => {
    const db = createTestDb();
    await migrate(db);
    // Simula una base v1: tabla cdts con el esquema anterior (source_account_id NOT NULL).
    await db.execAsync(`DROP TABLE cdts;
CREATE TABLE cdts (
  id TEXT PRIMARY KEY, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT NULL,
  account_id TEXT NOT NULL, issuer TEXT NOT NULL, certificate_number TEXT NULL, principal INTEGER NOT NULL,
  annual_rate_ea TEXT NOT NULL, annual_rate_nominal TEXT NOT NULL, term_days INTEGER NOT NULL,
  opened_on TEXT NOT NULL, matures_on TEXT NOT NULL, interest_payment TEXT NOT NULL,
  withholding_rate TEXT NOT NULL, source_account_id TEXT NOT NULL, payout_account_id TEXT NULL,
  status TEXT NOT NULL, renewed_from_cdt_id TEXT NULL, server_updated_at TEXT NULL,
  is_dirty INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_cdts_dirty ON cdts(id) WHERE is_dirty = 1;
INSERT INTO cdts VALUES ('c1', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, 'inv', 'Banco', NULL, 1000000,
  '10.0000', '9.5000', 90, '2026-01-01', '2026-04-01', 'AT_MATURITY', '4.00', 'src', NULL, 'ACTIVE', NULL,
  '2026-01-01T00:00:01Z', 1);
PRAGMA user_version = 1;`);

    await migrate(db);

    expect(await db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 2 });
    const row = await db.getFirstAsync<Record<string, unknown>>('SELECT * FROM cdts WHERE id = ?', ['c1']);
    expect(row).toMatchObject({
      principal: 1000000,
      source_account_id: 'src',
      server_updated_at: '2026-01-01T00:00:01Z',
      is_dirty: 1,
      maturity_value_override: null,
      settled_gross_interest: null,
      settled_withholding: null,
      settled_net_interest: null,
    });
    const info = await db.getAllAsync<{ name: string; notnull: number; type: string }>('PRAGMA table_info(cdts)');
    expect(info.find((c) => c.name === 'source_account_id')?.notnull).toBe(0);
    expect(info.find((c) => c.name === 'settled_net_interest')?.type).toBe('INTEGER');
    const index = await db.getFirstAsync("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_cdts_dirty'");
    expect(index).toEqual({ name: 'idx_cdts_dirty' });
    await db.runAsync("UPDATE cdts SET source_account_id = NULL WHERE id = 'c1'");
  });
});
