import { SYNC_TABLES } from '@/sync/tables';

import { appDbLock, type DbLock } from './writeLock';

/**
 * Vacía la base local al cerrar sesión o cambiar de cuenta (research R13). Se conserva el esquema
 * (`user_version`) y las filas de `sync_metadata`, con cursores y fechas en NULL: el próximo
 * inicio de sesión hace un primer sync completo.
 */
export async function wipeLocalData(lock: DbLock = appDbLock): Promise<void> {
  await lock.withWriteLock(async (db) => {
    for (const table of SYNC_TABLES) await db.runAsync(`DELETE FROM ${table}`);
    await db.runAsync('DELETE FROM sync_rejections');
    await db.runAsync('UPDATE sync_metadata SET pull_cursor = NULL, last_synced_at = NULL');
  });
}
