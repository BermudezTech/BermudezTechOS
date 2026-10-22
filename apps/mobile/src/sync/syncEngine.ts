import type { ApiClient } from '@/api/client';
import { ApiError, isApiError, NetworkError } from '@/api/errors';
import { rowToEntity, upsertSql, type AnyEntity } from '@/db/rows';
import type { SqlDatabase, SqlRow } from '@/db/types';
import type { DbLock } from '@/db/writeLock';
import { nowUtc } from '@/lib/dates';
import type { EntityName } from '@/modules/finance/domain/types';
import type { SessionState } from '@/session/sessionStore';

import { fromWire, ParseError, toWire, type WireRecord } from './mappers';
import { refreshCounters, useSyncStore, type SyncErrorKind } from './syncStore';
import { REFERENCES, SYNC_TABLES, tableToEntity, type SyncTable } from './tables';

export type SyncOutcome =
  | { kind: 'ok'; pushed: number; pulled: number; rejected: number }
  | { kind: 'skipped'; reason: 'offline' | 'expired' | 'signedOut' }
  | { kind: 'failed'; error: SyncErrorKind };

export interface SyncEngine {
  /** Un ciclo PUSH → PULL (research R8). Si ya hay uno en curso, se repite una vez al terminar (FR-020). */
  run(): Promise<SyncOutcome>;
}

export interface SyncEngineDeps {
  db: SqlDatabase;
  lock: DbLock;
  api: ApiClient;
  isOnline: () => boolean;
  getSession: () => Pick<SessionState, 'status' | 'expired'>;
  /** Refleja en el espejo en memoria los registros aplicados por el PULL. */
  applyToMirror?: (entity: EntityName, records: AnyEntity[]) => void;
  /** El servidor no respondió (estado visible "sin conexión"). */
  onNetworkError?: () => void;
  onReachable?: () => void;
  now?: () => string;
}

/** Máximo del servidor por PUSH (spec 004). */
export const PUSH_CHUNK = 500;

type Pending = { table: SyncTable; row: SqlRow };

interface PushResult {
  table: SyncTable;
  id: string;
  status: 'APPLIED' | 'DISCARDED' | 'REJECTED';
  code?: string;
  message?: string;
}

interface PullTable {
  records: unknown[];
  cursor: string | null;
  hasMore: boolean;
}

interface PullResponse {
  changes: Partial<Record<SyncTable, PullTable>>;
  hasMore: boolean;
}

/** Ordena las filas de una tabla para que las referenciadas dentro de la misma tabla vayan antes. */
function parentsFirst(table: SyncTable, rows: SqlRow[]): SqlRow[] {
  const selfRefs = REFERENCES[table].filter((r) => r.table === table).map((r) => r.column);
  if (selfRefs.length === 0) return rows;
  const byId = new Map(rows.map((r) => [r.id as string, r]));
  const sorted: SqlRow[] = [];
  const visited = new Set<string>();
  const visit = (row: SqlRow, depth = 0) => {
    const id = row.id as string;
    if (visited.has(id) || depth > rows.length) return;
    visited.add(id);
    for (const column of selfRefs) {
      const parent = byId.get(row[column] as string);
      if (parent) visit(parent, depth + 1);
    }
    sorted.push(row);
  };
  rows.forEach((r) => visit(r));
  return sorted;
}

function groupByTable(chunk: Pending[]): Partial<Record<SyncTable, WireRecord[]>> {
  const changes: Partial<Record<SyncTable, WireRecord[]>> = {};
  for (const { table, row } of chunk) (changes[table] ??= []).push(toWire(table, row));
  return changes;
}

export function createSyncEngine(deps: SyncEngineDeps): SyncEngine {
  const { db, lock, api, now = nowUtc } = deps;
  let running: Promise<SyncOutcome> | null = null;
  let rerunRequested = false;

  async function readPending(): Promise<Pending[]> {
    return lock.withReadLock(async () => {
      const pending: Pending[] = [];
      for (const table of SYNC_TABLES) {
        const rows = await db.getAllAsync<SqlRow>(`SELECT * FROM ${table} WHERE is_dirty = 1 ORDER BY id`);
        for (const row of parentsFirst(table, rows)) pending.push({ table, row });
      }
      return pending;
    });
  }

  /** Envía un trozo; con `413` lo parte a la mitad (defensa ante el límite de 2 MB). */
  async function sendChunk(chunk: Pending[]): Promise<{ chunk: Pending[]; results: PushResult[] }[]> {
    try {
      const response = await api.request<{ results: PushResult[] }>('POST', '/sync/push', { body: { changes: groupByTable(chunk) } });
      return [{ chunk, results: response.results }];
    } catch (error) {
      if (isApiError(error, 'PUSH_TOO_LARGE') && chunk.length > 1) {
        const half = Math.ceil(chunk.length / 2);
        return [...(await sendChunk(chunk.slice(0, half))), ...(await sendChunk(chunk.slice(half)))];
      }
      throw error;
    }
  }

  async function applyPushResults(chunk: Pending[], results: PushResult[]): Promise<{ pushed: number; rejected: number }> {
    const sent = new Map(chunk.map(({ table, row }) => [`${table}:${row.id}`, row.updated_at as string]));
    let pushed = 0;
    let rejected = 0;
    await lock.withWriteLock(async () => {
      for (const result of results) {
        const sentUpdatedAt = sent.get(`${result.table}:${result.id}`);
        if (sentUpdatedAt === undefined || !SYNC_TABLES.includes(result.table)) continue;
        if (result.status === 'REJECTED') {
          rejected++;
          await db.runAsync(
            'INSERT OR REPLACE INTO sync_rejections (table_name, record_id, code, message, sent_updated_at, rejected_at) VALUES (?, ?, ?, ?, ?, ?)',
            [result.table, result.id, result.code ?? 'UNKNOWN', result.message ?? '', sentUpdatedAt, now()],
          );
          continue;
        }
        pushed++;
        // Solo se limpia si no se volvió a editar mientras tanto (FR-014).
        await db.runAsync(`UPDATE ${result.table} SET is_dirty = 0 WHERE id = ? AND updated_at = ?`, [result.id, sentUpdatedAt]);
        await db.runAsync('DELETE FROM sync_rejections WHERE table_name = ? AND record_id = ?', [result.table, result.id]);
        // La versión ganadora ya pasó el cursor: se baja la tabla completa (research R9, constitución II).
        if (result.status === 'DISCARDED')
          await db.runAsync('UPDATE sync_metadata SET pull_cursor = NULL WHERE table_name = ?', [result.table]);
      }
    });
    return { pushed, rejected };
  }

  async function push(): Promise<{ pushed: number; rejected: number }> {
    const pending = await readPending();
    let pushed = 0;
    let rejected = 0;
    // Trozos en orden de dependencias: un trozo posterior puede referenciar uno ya aplicado.
    for (let i = 0; i < pending.length; i += PUSH_CHUNK) {
      for (const { chunk, results } of await sendChunk(pending.slice(i, i + PUSH_CHUNK))) {
        const counts = await applyPushResults(chunk, results);
        pushed += counts.pushed;
        rejected += counts.rejected;
      }
    }
    return { pushed, rejected };
  }

  /** Aplica una página con la regla de FR-017; guarda el cursor de las tablas que terminaron. */
  async function applyPage(page: PullResponse, cursors: Record<SyncTable, string | null>, done: Set<SyncTable>): Promise<number> {
    const mirror = new Map<SyncTable, AnyEntity[]>();
    let applied = 0;
    await lock.withWriteLock(async () => {
      for (const table of SYNC_TABLES) {
        const data = page.changes[table];
        if (!data) continue;
        for (const record of data.records) {
          let incoming: SqlRow;
          try {
            incoming = fromWire(table, record);
          } catch (error) {
            if (!(error instanceof ParseError) || !error.id) throw error;
            await db.runAsync(
              'INSERT OR REPLACE INTO sync_rejections (table_name, record_id, code, message, sent_updated_at, rejected_at) VALUES (?, ?, ?, ?, NULL, ?)',
              [table, error.id, 'LOCAL_PARSE_ERROR', error.message, now()],
            );
            continue;
          }
          const local = await db.getFirstAsync<{ is_dirty: number; updated_at: string }>(
            `SELECT is_dirty, updated_at FROM ${table} WHERE id = ?`,
            [incoming.id as string],
          );
          const overwrite = !local || local.is_dirty === 0 || Date.parse(incoming.updated_at as string) > Date.parse(local.updated_at);
          if (!overwrite) {
            // Se conserva la versión local pendiente; ahora se sabe que existe en el servidor.
            await db.runAsync(`UPDATE ${table} SET server_updated_at = ? WHERE id = ?`, [
              incoming.server_updated_at ?? null,
              incoming.id as string,
            ]);
            continue;
          }
          const { sql, params } = upsertSql(table, incoming);
          await db.runAsync(sql, params);
          await db.runAsync('DELETE FROM sync_rejections WHERE table_name = ? AND record_id = ?', [table, incoming.id as string]);
          (mirror.get(table) ?? mirror.set(table, []).get(table)!).push(rowToEntity(table, incoming));
          applied++;
        }
        cursors[table] = data.cursor;
        // El cursor se guarda cuando la tabla terminó, en la misma transacción que sus datos (FR-018).
        if (!data.hasMore && !done.has(table)) {
          done.add(table);
          await db.runAsync('UPDATE sync_metadata SET pull_cursor = ?, last_synced_at = ? WHERE table_name = ?', [
            data.cursor,
            now(),
            table,
          ]);
        }
      }
    });
    for (const [table, records] of mirror) deps.applyToMirror?.(tableToEntity[table], records);
    return applied;
  }

  async function pull(): Promise<number> {
    const rows = await lock.withReadLock(() =>
      db.getAllAsync<{ table_name: SyncTable; pull_cursor: string | null }>('SELECT * FROM sync_metadata'),
    );
    const cursors = Object.fromEntries(SYNC_TABLES.map((t) => [t, rows.find((r) => r.table_name === t)?.pull_cursor ?? null])) as Record<
      SyncTable,
      string | null
    >;
    const done = new Set<SyncTable>();
    const resetTables = new Set<SyncTable>();
    let pulled = 0;
    let hasMore = true;
    while (hasMore) {
      let page: PullResponse;
      try {
        page = await api.request<PullResponse>('POST', '/sync/pull', { body: { cursors } });
      } catch (error) {
        const table = isApiError(error, 'INVALID_CURSOR') ? (error.details as { table?: SyncTable }[] | undefined)?.[0]?.table : undefined;
        if (!table || !SYNC_TABLES.includes(table) || resetTables.has(table)) throw error;
        resetTables.add(table);
        cursors[table] = null;
        await lock.withWriteLock(() => db.runAsync('UPDATE sync_metadata SET pull_cursor = NULL WHERE table_name = ?', [table]));
        continue;
      }
      pulled += await applyPage(page, cursors, done);
      hasMore = page.hasMore;
    }
    return pulled;
  }

  async function cycle(): Promise<SyncOutcome> {
    try {
      useSyncStore.setState({ phase: 'pushing' });
      const { pushed, rejected } = await push();
      await refreshCounters(db);
      useSyncStore.setState({ phase: 'pulling' });
      const pulled = await pull();
      useSyncStore.setState({ lastError: null });
      deps.onReachable?.();
      return { kind: 'ok', pushed, pulled, rejected };
    } catch (error) {
      if (error instanceof NetworkError) {
        deps.onNetworkError?.();
        useSyncStore.setState({ lastError: { kind: 'network', message: error.message } });
        return { kind: 'failed', error: 'network' };
      }
      if (isApiError(error, 'SESSION_EXPIRED') || isApiError(error, 'SIGNED_OUT')) {
        useSyncStore.setState({ lastError: { kind: 'session', message: (error as ApiError).message } });
        return { kind: 'failed', error: 'session' };
      }
      useSyncStore.setState({ lastError: { kind: 'server', message: error instanceof Error ? error.message : String(error) } });
      return { kind: 'failed', error: 'server' };
    } finally {
      useSyncStore.setState({ phase: 'idle' });
      await refreshCounters(db).catch(() => {});
    }
  }

  function guard(): SyncOutcome | null {
    const session = deps.getSession();
    if (session.status !== 'signedIn') return { kind: 'skipped', reason: 'signedOut' };
    if (session.expired) return { kind: 'skipped', reason: 'expired' };
    if (!deps.isOnline()) return { kind: 'skipped', reason: 'offline' };
    return null;
  }

  return {
    run() {
      if (running) {
        rerunRequested = true;
        return running;
      }
      const skipped = guard();
      if (skipped) return Promise.resolve(skipped);
      running = (async () => {
        let outcome: SyncOutcome;
        do {
          rerunRequested = false;
          outcome = await cycle();
        } while (rerunRequested && outcome.kind === 'ok' && !guard());
        return outcome;
      })().finally(() => {
        running = null;
      });
      return running;
    },
  };
}
