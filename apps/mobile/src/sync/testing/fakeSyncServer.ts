/**
 * Servidor de sync en memoria para pruebas (specs/004-data-sync/contracts/http-api.md). Implementa
 * `ApiClient` sin HTTP: PUSH con last-write-wins y PULL paginado con cursores opacos. No usar en la app.
 */
import type { ApiClient, HttpMethod, RequestOptions } from '@/api/client';
import { ApiError, NetworkError } from '@/api/errors';

import type { WireRecord } from '../mappers';
import { SYNC_TABLES, type SyncTable } from '../tables';

interface Stored {
  record: WireRecord;
  serverUpdatedAt: string;
}

type PushStatus = 'APPLIED' | 'DISCARDED' | 'REJECTED';

export interface PushResult {
  table: SyncTable;
  id: string;
  status: PushStatus;
  code?: string;
  message?: string;
}

interface Cursor {
  t: string;
  id: string;
}

const encode = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString('base64');
const decode = (s: string): Cursor => JSON.parse(Buffer.from(s, 'base64').toString('utf8')) as Cursor;
const after = (s: Stored, id: string, c: Cursor | null) => !c || s.serverUpdatedAt > c.t || (s.serverUpdatedAt === c.t && id > c.id);
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class FakeSyncServer implements ApiClient {
  readonly tables = new Map<SyncTable, Map<string, Stored>>(SYNC_TABLES.map((t) => [t, new Map()]));
  /** Límite de registros por PULL (todas las tablas). */
  pageSize = 1000;
  /** Máximo de registros por PUSH antes de `413`. */
  pushLimit = 500;
  readonly calls: { path: string; body: unknown }[] = [];
  private clock = Date.parse('2026-10-20T12:00:00.000Z');
  private readonly forcedRejections = new Map<string, { code: string; message: string }>();
  private readonly failures: { path: string; error: Error; afterApply: boolean }[] = [];
  private readonly invalidCursors = new Set<SyncTable>();

  /** Marca del servidor estrictamente creciente, con microsegundos como el real. */
  private tick(): string {
    this.clock += 1;
    return new Date(this.clock).toISOString().replace('Z', '123Z');
  }

  /** Guarda un registro como si otro dispositivo lo hubiera subido. */
  put(table: SyncTable, record: WireRecord): void {
    this.tables.get(table)!.set(record.id as string, { record: clone(record), serverUpdatedAt: this.tick() });
  }

  get(table: SyncTable, id: string): WireRecord | undefined {
    return this.tables.get(table)!.get(id)?.record;
  }

  count(table: SyncTable): number {
    return this.tables.get(table)!.size;
  }

  rejectId(id: string, code: string, message = `Rechazado: ${code}`): void {
    this.forcedRejections.set(id, { code, message });
  }

  clearRejection(id: string): void {
    this.forcedRejections.delete(id);
  }

  /**
   * La próxima petición a `path` falla con `error` (por defecto, sin red). Con `afterApply`, el
   * servidor la procesa y se pierde la respuesta.
   */
  failNext(
    path: '/sync/push' | '/sync/pull',
    { error = new NetworkError(), afterApply = false }: { error?: Error; afterApply?: boolean } = {},
  ): void {
    this.failures.push({ path, error, afterApply });
  }

  /** El próximo PULL responde `422 INVALID_CURSOR` si trae cursor para `table`. */
  invalidateCursor(table: SyncTable): void {
    this.invalidCursors.add(table);
  }

  async request<T>(method: HttpMethod, path: string, { body }: RequestOptions = {}): Promise<T> {
    if (method !== 'POST') throw new ApiError(404, 'NOT_FOUND', path);
    const payload = clone(body);
    this.calls.push({ path, body: payload });
    const index = this.failures.findIndex((f) => f.path === path);
    const failure = index >= 0 ? this.failures.splice(index, 1)[0]! : null;
    if (failure && !failure.afterApply) throw failure.error;
    let response: unknown;
    if (path === '/sync/push') response = this.push(payload as { changes: Partial<Record<SyncTable, WireRecord[]>> });
    else if (path === '/sync/pull') response = this.pull(payload as { cursors?: Partial<Record<SyncTable, string | null>> });
    else throw new ApiError(404, 'NOT_FOUND', path);
    if (failure) throw failure.error;
    return response as T;
  }

  private push({ changes }: { changes: Partial<Record<SyncTable, WireRecord[]>> }) {
    const total = Object.values(changes).reduce((n, list) => n + (list?.length ?? 0), 0);
    if (total > this.pushLimit) throw new ApiError(413, 'PUSH_TOO_LARGE', 'Demasiados registros.');
    const results: PushResult[] = [];
    for (const table of SYNC_TABLES) {
      for (const incoming of changes[table] ?? []) {
        const id = incoming.id as string;
        const forced = this.forcedRejections.get(id);
        if (forced) {
          results.push({ table, id, status: 'REJECTED', ...forced });
          continue;
        }
        const stored = this.tables.get(table)!.get(id);
        if (stored && Date.parse(incoming.updatedAt as string) <= Date.parse(stored.record.updatedAt as string)) {
          results.push({ table, id, status: 'DISCARDED' });
          continue;
        }
        const { serverUpdatedAt: _s, isDirty: _d, userId: _u, ...record } = incoming;
        this.tables.get(table)!.set(id, { record, serverUpdatedAt: this.tick() });
        results.push({ table, id, status: 'APPLIED' });
      }
    }
    return { results, serverTime: new Date(this.clock).toISOString() };
  }

  private pull({ cursors = {} }: { cursors?: Partial<Record<SyncTable, string | null>> }) {
    for (const table of this.invalidCursors) {
      if (cursors[table]) {
        this.invalidCursors.delete(table);
        throw new ApiError(422, 'INVALID_CURSOR', 'Cursor inválido.', [{ table }]);
      }
    }
    let budget = this.pageSize;
    const changes: Record<string, { records: WireRecord[]; cursor: string | null; hasMore: boolean }> = {};
    for (const table of SYNC_TABLES) {
      const raw = cursors[table] ?? null;
      const cursor = raw ? decode(raw) : null;
      const pending = [...this.tables.get(table)!.entries()]
        .filter(([id, s]) => after(s, id, cursor))
        .sort(([idA, a], [idB, b]) =>
          a.serverUpdatedAt === b.serverUpdatedAt ? idA.localeCompare(idB) : a.serverUpdatedAt < b.serverUpdatedAt ? -1 : 1,
        );
      const page = pending.slice(0, Math.max(0, budget));
      budget -= page.length;
      const last = page[page.length - 1];
      changes[table] = {
        records: page.map(([, s]) => ({ ...clone(s.record), serverUpdatedAt: s.serverUpdatedAt })),
        cursor: last ? encode({ t: last[1].serverUpdatedAt, id: last[0] }) : raw,
        hasMore: page.length < pending.length,
      };
    }
    return { changes, hasMore: Object.values(changes).some((c) => c.hasMore) };
  }
}
