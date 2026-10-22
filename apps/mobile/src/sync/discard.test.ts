import { entityToRow, upsertSql, type AnyEntity } from '@/db/rows';
import { migrate } from '@/db/schema';
import { createTestDb } from '@/db/testing/betterSqlite';
import type { SqlDatabase } from '@/db/types';
import { createDbLock } from '@/db/writeLock';
import { makeAccount, makeCdt, makeTx } from '@/modules/finance/domain/testUtils';

import { countDependents, discardLocalChange, type DiscardDeps } from './discard';
import { toWire } from './mappers';
import { createSyncEngine } from './syncEngine';
import type { SyncTable } from './tables';
import { FakeSyncServer } from './testing/fakeSyncServer';

let db: SqlDatabase;
let deps: DiscardDeps & { removed: Record<string, string[]> };

async function writeLocal(table: SyncTable, entity: AnyEntity, extra: Record<string, string | number | null> = {}) {
  const { sql, params } = upsertSql(table, { ...entityToRow(table, entity), is_dirty: 1, ...extra });
  await db.runAsync(sql, params);
}

const reject = (table: SyncTable, id: string) =>
  db.runAsync("INSERT INTO sync_rejections VALUES (?, ?, 'INVALID_REFERENCE', 'x', NULL, '2026-10-20T10:00:00.000Z')", [table, id]);
const count = async (table: string, where = '1') =>
  (await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`))!.n;

beforeEach(async () => {
  db = createTestDb();
  await migrate(db);
  const removed: Record<string, string[]> = {};
  deps = {
    db,
    lock: createDbLock(() => db),
    removeFromMirror: (entity, ids) => (removed[entity] = [...(removed[entity] ?? []), ...ids]),
    removed,
  };
});

describe('Descartar mi cambio (FR-015a)', () => {
  it('registro que ya existía en el servidor: deja de estar pendiente y el siguiente sync trae la versión del servidor', async () => {
    const server = new FakeSyncServer();
    server.put('accounts', toWire('accounts', entityToRow('accounts', makeAccount({ id: 'acc', name: 'Servidor' }))));
    const engine = createSyncEngine({
      db,
      lock: deps.lock,
      api: server,
      isOnline: () => true,
      getSession: () => ({ status: 'signedIn', expired: false }),
    });
    await engine.run();
    await writeLocal('accounts', makeAccount({ id: 'acc', name: 'Local', updatedAt: '2026-10-21T00:00:00.000Z' }), {
      server_updated_at: '2026-10-20T12:00:00.001123Z',
    });
    await reject('accounts', 'acc');
    expect(await countDependents(db, 'accounts', 'acc')).toBe(0);
    await discardLocalChange('accounts', 'acc', deps);
    expect(await count('accounts', 'is_dirty = 1')).toBe(0);
    expect(await count('sync_rejections')).toBe(0);
    expect(
      (await db.getFirstAsync<{ c: string | null }>("SELECT pull_cursor AS c FROM sync_metadata WHERE table_name = 'accounts'"))!.c,
    ).toBeNull();
    await engine.run();
    expect(await db.getFirstAsync("SELECT name FROM accounts WHERE id = 'acc'")).toEqual({ name: 'Servidor' });
  });

  it('cuenta nueva rechazada con 2 movimientos pendientes: se borran los 3 y sus rechazos', async () => {
    await writeLocal('accounts', makeAccount({ id: 'acc' }));
    await writeLocal('transactions', makeTx({ id: 't1', accountId: 'acc' }));
    await writeLocal('transactions', makeTx({ id: 't2', accountId: 'other', counterAccountId: 'acc', type: 'TRANSFER' }));
    await writeLocal('transactions', makeTx({ id: 'unrelated', accountId: 'other' }));
    await reject('accounts', 'acc');
    await reject('transactions', 't1');
    expect(await countDependents(db, 'accounts', 'acc')).toBe(2);
    await discardLocalChange('accounts', 'acc', deps);
    expect(await count('accounts')).toBe(0);
    expect(await count('transactions')).toBe(1);
    expect(await count('sync_rejections')).toBe(0);
    expect(deps.removed).toEqual({ accounts: ['acc'], transactions: ['t1', 't2'] });
  });

  it('incluye dependientes transitivos (cuenta → CDT → movimiento)', async () => {
    await writeLocal('accounts', makeAccount({ id: 'acc' }));
    await writeLocal('cdts', makeCdt({ id: 'cdt', accountId: 'inv', sourceAccountId: 'acc' }));
    await writeLocal('transactions', makeTx({ id: 'tx', accountId: 'other', cdtId: 'cdt' }));
    expect(await countDependents(db, 'accounts', 'acc')).toBe(2);
  });

  it('solo cuenta dependientes pendientes de subir', async () => {
    await writeLocal('accounts', makeAccount({ id: 'acc' }));
    await writeLocal('transactions', makeTx({ id: 'synced', accountId: 'acc' }), { is_dirty: 0 });
    expect(await countDependents(db, 'accounts', 'acc')).toBe(0);
  });
});
