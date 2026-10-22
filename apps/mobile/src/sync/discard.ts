import { getDb } from '@/db/openLocalDb';
import type { SqlDatabase } from '@/db/types';
import { appDbLock, type DbLock } from '@/db/writeLock';
import { removeRows } from '@/modules/finance/data/local/store';
import type { EntityName } from '@/modules/finance/domain/types';

import { refreshCounters } from './syncStore';
import { REFERENCES, SYNC_TABLES, tableToEntity, type SyncTable } from './tables';

export interface DiscardDeps {
  db: SqlDatabase;
  lock: DbLock;
  removeFromMirror: (entity: EntityName, ids: string[]) => void;
}

const appDeps = (): DiscardDeps => ({ db: getDb(), lock: appDbLock, removeFromMirror: removeRows });

type Ref = { table: SyncTable; id: string };

/** Filas pendientes que referencian a `table/id`, de forma transitiva (data-model §3). */
async function dependents(db: SqlDatabase, table: SyncTable, id: string): Promise<Ref[]> {
  const seen = new Set([`${table}:${id}`]);
  const found: Ref[] = [];
  const queue: Ref[] = [{ table, id }];
  while (queue.length > 0) {
    const target = queue.shift()!;
    for (const source of SYNC_TABLES) {
      for (const ref of REFERENCES[source].filter((r) => r.table === target.table)) {
        const rows = await db.getAllAsync<{ id: string }>(`SELECT id FROM ${source} WHERE is_dirty = 1 AND ${ref.column} = ? ORDER BY id`, [
          target.id,
        ]);
        for (const { id: depId } of rows) {
          const key = `${source}:${depId}`;
          if (seen.has(key)) continue;
          seen.add(key);
          found.push({ table: source, id: depId });
          queue.push({ table: source, id: depId });
        }
      }
    }
  }
  return found;
}

/** Cuántos cambios pendientes se descartarían junto con un registro nunca subido (confirmación). */
export async function countDependents(db: SqlDatabase, table: SyncTable, id: string): Promise<number> {
  return (await dependents(db, table, id)).length;
}

/**
 * "Descartar mi cambio" de un registro rechazado (FR-015a, research R10):
 * - si existía en el servidor, deja de estar pendiente y el siguiente sync baja su versión;
 * - si nunca llegó, se borra físicamente con sus dependientes pendientes y sus rechazos.
 * En ambos casos se reinicia el cursor de las tablas afectadas (constitución II, v1.1.0).
 */
export async function discardLocalChange(table: SyncTable, id: string, deps: DiscardDeps = appDeps()): Promise<void> {
  const { db, lock } = deps;
  const removed = await lock.withWriteLock(async () => {
    const row = await db.getFirstAsync<{ server_updated_at: string | null }>(`SELECT server_updated_at FROM ${table} WHERE id = ?`, [id]);
    if (row?.server_updated_at) {
      await db.runAsync(`UPDATE ${table} SET is_dirty = 0 WHERE id = ?`, [id]);
      await db.runAsync('DELETE FROM sync_rejections WHERE table_name = ? AND record_id = ?', [table, id]);
      await db.runAsync('UPDATE sync_metadata SET pull_cursor = NULL WHERE table_name = ?', [table]);
      return [];
    }
    const refs = [{ table, id }, ...(await dependents(db, table, id))];
    for (const ref of refs) {
      await db.runAsync(`DELETE FROM ${ref.table} WHERE id = ?`, [ref.id]);
      await db.runAsync('DELETE FROM sync_rejections WHERE table_name = ? AND record_id = ?', [ref.table, ref.id]);
    }
    for (const t of new Set(refs.map((r) => r.table)))
      await db.runAsync('UPDATE sync_metadata SET pull_cursor = NULL WHERE table_name = ?', [t]);
    return refs;
  });
  const byEntity = new Map<EntityName, string[]>();
  for (const ref of removed) {
    const entity = tableToEntity[ref.table];
    byEntity.set(entity, [...(byEntity.get(entity) ?? []), ref.id]);
  }
  for (const [entity, ids] of byEntity) deps.removeFromMirror(entity, ids);
  await refreshCounters(db);
}
