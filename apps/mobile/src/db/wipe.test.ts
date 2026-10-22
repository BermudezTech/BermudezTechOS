import { makeAccount } from '@/modules/finance/domain/testUtils';
import { SYNC_TABLES } from '@/sync/tables';

import { entityToRow, upsertSql } from './rows';
import { migrate, MIGRATIONS } from './schema';
import { createTestDb } from './testing/betterSqlite';
import { wipeLocalData } from './wipe';
import { createDbLock } from './writeLock';

it('wipeLocalData vacía las tablas y los rechazos, y reinicia sync_metadata sin tocar el esquema', async () => {
  const db = createTestDb();
  await migrate(db);
  const { sql, params } = upsertSql('accounts', { ...entityToRow('accounts', makeAccount({ id: 'a' })), is_dirty: 1 });
  await db.runAsync(sql, params);
  await db.runAsync("INSERT INTO sync_rejections VALUES ('accounts', 'a', 'DUPLICATE', 'x', NULL, '2026-10-20T00:00:00.000Z')");
  await db.runAsync("UPDATE sync_metadata SET pull_cursor = 'c', last_synced_at = '2026-10-20T00:00:00.000Z'");

  await wipeLocalData(createDbLock(() => db));

  for (const table of [...SYNC_TABLES, 'sync_rejections']) {
    expect(await db.getFirstAsync(`SELECT COUNT(*) AS n FROM ${table}`)).toEqual({ n: 0 });
  }
  expect(
    await db.getFirstAsync('SELECT COUNT(*) AS n, SUM(pull_cursor IS NULL AND last_synced_at IS NULL) AS clean FROM sync_metadata'),
  ).toEqual({
    n: 8,
    clean: 8,
  });
  expect(await db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: MIGRATIONS.length });
});
