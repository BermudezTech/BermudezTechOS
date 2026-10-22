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
});
