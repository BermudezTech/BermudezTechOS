import { NetworkError } from '@/api/errors';
import { entityToRow, upsertSql, type AnyEntity } from '@/db/rows';
import { migrate } from '@/db/schema';
import { createTestDb } from '@/db/testing/betterSqlite';
import type { SqlDatabase, SqlRow } from '@/db/types';
import { createDbLock } from '@/db/writeLock';
import { cents } from '@/lib/money';
import { makeAccount, makeCategory, makeTx } from '@/modules/finance/domain/testUtils';

import { toWire } from './mappers';
import { createSyncEngine, type SyncOutcome } from './syncEngine';
import { SYNC_TABLES, type SyncTable } from './tables';
import { FakeSyncServer } from './testing/fakeSyncServer';

type Device = Awaited<ReturnType<typeof createDevice>>;

async function createDevice(server: FakeSyncServer) {
  const db = createTestDb();
  await migrate(db);
  const engine = createSyncEngine({
    db,
    lock: createDbLock(() => db),
    api: server,
    isOnline: () => true,
    getSession: () => ({ status: 'signedIn', expired: false }),
  });
  return { db, engine, run: () => engine.run() };
}

/** Escritura local de la app: fila completa pendiente de subir. */
async function writeLocal(db: SqlDatabase, table: SyncTable, entity: AnyEntity) {
  const { sql, params } = upsertSql(table, { ...entityToRow(table, entity), is_dirty: 1 });
  await db.runAsync(sql, params);
}

const wire = (table: SyncTable, entity: AnyEntity) => toWire(table, entityToRow(table, entity));
const row = (db: SqlDatabase, table: SyncTable, id: string) => db.getFirstAsync<SqlRow>(`SELECT * FROM ${table} WHERE id = ?`, [id]);
const count = async (db: SqlDatabase, table: string, where = '1') =>
  (await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`))!.n;

const ok = (outcome: SyncOutcome) => expect(outcome.kind).toBe('ok');

let server: FakeSyncServer;
let device: Device;

beforeEach(async () => {
  server = new FakeSyncServer();
  device = await createDevice(server);
});

describe('syncEngine', () => {
  it('(a) primer sync: baja las 15 categorías y guarda cursor y fecha en las 8 tablas', async () => {
    for (let i = 0; i < 15; i++) server.put('categories', wire('categories', makeCategory({ id: `cat-${i}`, name: `Cat ${i}` })));
    ok(await device.run());
    expect(await count(device.db, 'categories')).toBe(15);
    expect(await count(device.db, 'categories', 'is_dirty = 0 AND server_updated_at IS NOT NULL')).toBe(15);
    expect(await count(device.db, 'sync_metadata', 'last_synced_at IS NOT NULL')).toBe(8);
    expect(
      (await device.db.getFirstAsync<{ pull_cursor: string }>("SELECT pull_cursor FROM sync_metadata WHERE table_name = 'categories'"))!
        .pull_cursor,
    ).toBeTruthy();
  });

  it('(b) sube cuenta y movimiento pendientes y los marca sincronizados', async () => {
    await writeLocal(device.db, 'accounts', makeAccount({ id: 'acc' }));
    await writeLocal(device.db, 'transactions', makeTx({ id: 'tx', accountId: 'acc' }));
    const outcome = await device.run();
    expect(outcome).toMatchObject({ kind: 'ok', pushed: 2, rejected: 0 });
    expect(await count(device.db, 'accounts', 'is_dirty = 1')).toBe(0);
    expect(await count(device.db, 'transactions', 'is_dirty = 1')).toBe(0);
    expect(server.get('accounts', 'acc')).toBeDefined();
    expect(server.get('transactions', 'tx')).toBeDefined();
  });

  it('(c) un registro editado mientras se subía sigue pendiente (FR-014)', async () => {
    await writeLocal(device.db, 'accounts', makeAccount({ id: 'acc', updatedAt: '2026-10-20T10:00:00.000Z' }));
    const request = server.request.bind(server);
    server.request = async (method, path, options) => {
      const response = await request(method, path, options);
      if (path === '/sync/push')
        await writeLocal(device.db, 'accounts', makeAccount({ id: 'acc', name: 'Editada', updatedAt: '2026-10-20T10:00:01.000Z' }));
      return response as never;
    };
    ok(await device.run());
    expect(await row(device.db, 'accounts', 'acc')).toMatchObject({ is_dirty: 1, name: 'Editada' });
  });

  it('(d) DISCARDED: deja de estar pendiente, reinicia el cursor de la tabla y baja la versión del servidor', async () => {
    server.put('accounts', wire('accounts', makeAccount({ id: 'acc', name: 'Servidor', updatedAt: '2026-10-20T10:05:00.000Z' })));
    ok(await device.run());
    // Reloj atrasado: la edición local es más vieja que la del servidor.
    await writeLocal(device.db, 'accounts', makeAccount({ id: 'acc', name: 'Local', updatedAt: '2026-10-20T10:00:00.000Z' }));
    ok(await device.run());
    expect(await row(device.db, 'accounts', 'acc')).toMatchObject({ is_dirty: 0, name: 'Servidor' });
    const pulls = server.calls.filter((c) => c.path === '/sync/pull');
    expect((pulls[pulls.length - 1]!.body as { cursors: Record<string, string | null> }).cursors.accounts).toBeNull();
  });

  it('(e) REJECTED: queda pendiente con su motivo y no frena al resto', async () => {
    server.rejectId('tx', 'INCOHERENT', 'Un gasto solo puede usar una categoría de gasto.');
    await writeLocal(device.db, 'accounts', makeAccount({ id: 'acc' }));
    await writeLocal(device.db, 'transactions', makeTx({ id: 'tx', accountId: 'acc' }));
    expect(await device.run()).toMatchObject({ kind: 'ok', rejected: 1 });
    expect(await row(device.db, 'transactions', 'tx')).toMatchObject({ is_dirty: 1 });
    expect(await row(device.db, 'accounts', 'acc')).toMatchObject({ is_dirty: 0 });
    expect(await device.db.getFirstAsync('SELECT table_name, record_id, code, message FROM sync_rejections')).toEqual({
      table_name: 'transactions',
      record_id: 'tx',
      code: 'INCOHERENT',
      message: 'Un gasto solo puede usar una categoría de gasto.',
    });
  });

  describe('(f) regla de la bajada (FR-017)', () => {
    it('sobrescribe una fila local sin cambios pendientes', async () => {
      server.put('accounts', wire('accounts', makeAccount({ id: 'acc', name: 'v1', updatedAt: '2026-10-20T10:00:00.000Z' })));
      ok(await device.run());
      server.put('accounts', wire('accounts', makeAccount({ id: 'acc', name: 'v2', updatedAt: '2026-10-20T10:05:00.000Z' })));
      ok(await device.run());
      expect(await row(device.db, 'accounts', 'acc')).toMatchObject({ name: 'v2', is_dirty: 0 });
    });

    it('conserva una fila pendiente más nueva que la del servidor', async () => {
      server.rejectId('acc', 'VALIDATION_ERROR');
      server.put('accounts', wire('accounts', makeAccount({ id: 'acc', name: 'Servidor', updatedAt: '2026-10-20T10:05:00.000Z' })));
      await writeLocal(device.db, 'accounts', makeAccount({ id: 'acc', name: 'Local', updatedAt: '2026-10-20T10:10:00.000Z' }));
      ok(await device.run());
      expect(await row(device.db, 'accounts', 'acc')).toMatchObject({ name: 'Local', is_dirty: 1 });
      expect((await row(device.db, 'accounts', 'acc'))!.server_updated_at).toBeTruthy();
    });

    it('sobrescribe una fila pendiente más vieja, la limpia y borra su rechazo', async () => {
      server.rejectId('acc', 'VALIDATION_ERROR');
      server.put('accounts', wire('accounts', makeAccount({ id: 'acc', name: 'Servidor', updatedAt: '2026-10-20T10:05:00.000Z' })));
      await writeLocal(device.db, 'accounts', makeAccount({ id: 'acc', name: 'Local', updatedAt: '2026-10-20T10:00:00.000Z' }));
      ok(await device.run());
      expect(await row(device.db, 'accounts', 'acc')).toMatchObject({ name: 'Servidor', is_dirty: 0 });
      expect(await count(device.db, 'sync_rejections')).toBe(0);
    });
  });

  it('(g) sigue la paginación hasta el final sin duplicados', async () => {
    server.pageSize = 3;
    for (let i = 0; i < 10; i++) server.put('categories', wire('categories', makeCategory({ id: `cat-${i}` })));
    ok(await device.run());
    expect(await count(device.db, 'categories')).toBe(10);
    expect(server.calls.filter((c) => c.path === '/sync/pull')).toHaveLength(4);
  });

  describe('(h) interrumpir y reintentar deja el mismo estado (SC-005)', () => {
    async function scenario() {
      const s = new FakeSyncServer();
      s.pageSize = 3;
      for (let i = 0; i < 7; i++) s.put('categories', wire('categories', makeCategory({ id: `cat-${i}` })));
      s.put('accounts', wire('accounts', makeAccount({ id: 'remote', updatedAt: '2026-10-20T09:00:00.000Z' })));
      const d = await createDevice(s);
      await writeLocal(d.db, 'accounts', makeAccount({ id: 'acc', openingBalance: cents(10) }));
      for (let i = 0; i < 4; i++) await writeLocal(d.db, 'transactions', makeTx({ id: `tx-${i}`, accountId: 'acc', amount: cents(20) }));
      return { s, d };
    }

    async function snapshot(s: FakeSyncServer, d: Device) {
      const local: Record<string, SqlRow[]> = {};
      for (const t of SYNC_TABLES) local[t] = await d.db.getAllAsync<SqlRow>(`SELECT * FROM ${t} ORDER BY id`);
      const remote = Object.fromEntries(SYNC_TABLES.map((t) => [t, [...s.tables.get(t)!.entries()].sort()]));
      return { local, remote };
    }

    let baseline: Awaited<ReturnType<typeof snapshot>>;

    beforeAll(async () => {
      const { s, d } = await scenario();
      ok(await d.run());
      baseline = await snapshot(s, d);
    });

    const failures: [string, (s: FakeSyncServer, d: Device) => void][] = [
      ['sin red al subir', (s) => s.failNext('/sync/push')],
      ['respuesta del PUSH perdida', (s) => s.failNext('/sync/push', { afterApply: true })],
      ['sin red en la 1.ª página', (s) => s.failNext('/sync/pull')],
      [
        'sin red en la 2.ª página',
        (s) => {
          const request = s.request.bind(s);
          let pulls = 0;
          s.request = async (method, path, options) => {
            if (path === '/sync/pull' && ++pulls === 2) throw new NetworkError();
            return request(method, path, options);
          };
        },
      ],
      [
        'la app se cierra a mitad de aplicar una página',
        (_s, d) => {
          const original = d.db.runAsync.bind(d.db);
          let fired = false;
          d.db.runAsync = async (sql, params) => {
            if (!fired && sql.startsWith('INSERT INTO categories')) {
              fired = true;
              throw new Error('app cerrada');
            }
            return original(sql, params);
          };
        },
      ],
    ];

    it.each(failures)('%s', async (_name, inject) => {
      const { s, d } = await scenario();
      inject(s, d);
      expect((await d.run().catch(() => ({ kind: 'failed' }))).kind).toBe('failed');
      let attempts = 0;
      let outcome: SyncOutcome;
      do {
        outcome = await d.run();
        attempts++;
      } while (outcome.kind !== 'ok' && attempts < 5);
      ok(outcome);
      expect(await snapshot(s, d)).toEqual(baseline);
    });
  });

  it('(i) 1.200 pendientes: trozos ≤ 500, padres primero, y 413 parte el trozo', async () => {
    server.pushLimit = 300;
    await writeLocal(device.db, 'accounts', makeAccount({ id: 'pocket', type: 'POCKET', parentAccountId: 'parent' }));
    await writeLocal(device.db, 'accounts', makeAccount({ id: 'parent' }));
    for (let i = 0; i < 1198; i++)
      await writeLocal(device.db, 'transactions', makeTx({ id: `tx-${String(i).padStart(4, '0')}`, accountId: 'parent' }));
    ok(await device.run());
    const pushes = server.calls
      .filter((c) => c.path === '/sync/push')
      .map((c) => (c.body as { changes: Record<string, { id: string }[]> }).changes);
    const sizes = pushes.map((p) => Object.values(p).reduce((n, list) => n + list.length, 0));
    expect(Math.max(...sizes)).toBeLessThanOrEqual(500);
    expect(sizes.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(1200);
    expect(pushes[0]!.accounts!.map((a) => a.id)).toEqual(['parent', 'pocket']);
    expect(server.count('transactions')).toBe(1198);
    expect(await count(device.db, 'transactions', 'is_dirty = 1')).toBe(0);
  });

  it('(j) 422 INVALID_CURSOR: reinicia el cursor de esa tabla y la baja completa', async () => {
    server.put('accounts', wire('accounts', makeAccount({ id: 'a1' })));
    ok(await device.run());
    server.put('accounts', wire('accounts', makeAccount({ id: 'a2' })));
    server.invalidateCursor('accounts');
    ok(await device.run());
    expect(await count(device.db, 'accounts')).toBe(2);
    const pulls = server.calls
      .filter((c) => c.path === '/sync/pull')
      .map((c) => (c.body as { cursors: Record<string, string | null> }).cursors);
    expect(pulls[pulls.length - 1]!.accounts).toBeNull();
  });

  it('(k) un monto mal formado se omite y se registra; el resto de la página se aplica', async () => {
    server.put('categories', wire('categories', makeCategory({ id: 'cat' })));
    server.put('transactions', { ...wire('transactions', makeTx({ id: 'bad' })), amount: '1.234' });
    server.put('transactions', wire('transactions', makeTx({ id: 'good' })));
    ok(await device.run());
    expect(await row(device.db, 'transactions', 'bad')).toBeNull();
    expect(await row(device.db, 'transactions', 'good')).not.toBeNull();
    expect(await device.db.getFirstAsync('SELECT table_name, record_id, code FROM sync_rejections')).toEqual({
      table_name: 'transactions',
      record_id: 'bad',
      code: 'LOCAL_PARSE_ERROR',
    });
  });

  it.each([
    ['A, B, A', ['a', 'b', 'a']],
    ['B, A, B', ['b', 'a', 'b']],
  ])('(l) dos dispositivos editan sin red; gana la edición más reciente en cualquier orden (%s)', async (_order, sequence) => {
    const a = device;
    const b = await createDevice(server);
    server.put('accounts', wire('accounts', makeAccount({ id: 'acc', name: 'Base', updatedAt: '2026-10-20T09:00:00.000Z' })));
    ok(await a.run());
    ok(await b.run());
    await writeLocal(a.db, 'accounts', makeAccount({ id: 'acc', name: 'A 10:00', updatedAt: '2026-10-20T10:00:00.000Z' }));
    await writeLocal(b.db, 'accounts', makeAccount({ id: 'acc', name: 'B 10:05', updatedAt: '2026-10-20T10:05:00.000Z' }));
    for (const who of sequence) ok(await (who === 'a' ? a : b).run());
    expect(await row(a.db, 'accounts', 'acc')).toMatchObject({ name: 'B 10:05', is_dirty: 0 });
    expect(await row(b.db, 'accounts', 'acc')).toMatchObject({ name: 'B 10:05', is_dirty: 0 });
    expect(server.get('accounts', 'acc')).toMatchObject({ name: 'B 10:05' });
  });

  it('(m) 0.10 + 0.20 subidos desde A llegan a B como exactamente 30 centavos (SC-007)', async () => {
    const b = await createDevice(server);
    await writeLocal(device.db, 'accounts', makeAccount({ id: 'acc', openingBalance: cents(10) }));
    await writeLocal(device.db, 'transactions', makeTx({ id: 'tx', accountId: 'acc', type: 'INCOME', amount: cents(20) }));
    ok(await device.run());
    expect(server.get('accounts', 'acc')).toMatchObject({ openingBalance: '0.10' });
    ok(await b.run());
    const opening = (await row(b.db, 'accounts', 'acc'))!.opening_balance as number;
    const amount = (await row(b.db, 'transactions', 'tx'))!.amount as number;
    expect(opening + amount).toBe(30);
  });

  it('salta el ciclo sin red o con la sesión vencida, sin llamar al servidor', async () => {
    const offline = createSyncEngine({
      db: device.db,
      lock: createDbLock(() => device.db),
      api: server,
      isOnline: () => false,
      getSession: () => ({ status: 'signedIn', expired: false }),
    });
    expect(await offline.run()).toEqual({ kind: 'skipped', reason: 'offline' });
    const expired = createSyncEngine({
      db: device.db,
      lock: createDbLock(() => device.db),
      api: server,
      isOnline: () => true,
      getSession: () => ({ status: 'signedIn', expired: true }),
    });
    expect(await expired.run()).toEqual({ kind: 'skipped', reason: 'expired' });
    expect(server.calls).toHaveLength(0);
  });

  it('un run pedido durante otro se ejecuta una sola vez al terminar (FR-020)', async () => {
    await writeLocal(device.db, 'accounts', makeAccount({ id: 'acc' }));
    const results = await Promise.all([device.run(), device.run(), device.run()]);
    expect(results.every((r) => r.kind === 'ok')).toBe(true);
    expect(server.calls.filter((c) => c.path === '/sync/push')).toHaveLength(1);
    // Un ciclo + una repetición: dos rondas de PULL.
    expect(server.calls.filter((c) => c.path === '/sync/pull')).toHaveLength(2);
  });
});
