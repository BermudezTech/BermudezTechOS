import * as SQLite from 'expo-sqlite';

import { migrate } from './schema';
import type { SqlDatabase } from './types';
import { setLockedDb } from './writeLock';

/** Adapta `SQLiteDatabase` a la interfaz mínima `SqlDatabase`. */
function adapt(native: SQLite.SQLiteDatabase): SqlDatabase {
  return {
    execAsync: (sql) => native.execAsync(sql),
    runAsync: async (sql, params = []) => ({ changes: (await native.runAsync(sql, params)).changes }),
    getAllAsync: (sql, params = []) => native.getAllAsync(sql, params),
    getFirstAsync: (sql, params = []) => native.getFirstAsync(sql, params),
    withTransactionAsync: (task) => native.withTransactionAsync(task),
  };
}

let opening: Promise<SqlDatabase> | null = null;
let opened: SqlDatabase | null = null;

/**
 * Abre `bermudeztech.db` y aplica las migraciones. Es idempotente: si ya está abierta (o
 * abriéndose) devuelve la misma conexión.
 */
export function openLocalDb(): Promise<SqlDatabase> {
  opening ??= (async () => {
    const db = adapt(await SQLite.openDatabaseAsync('bermudeztech.db'));
    await migrate(db);
    setLockedDb(db);
    opened = db;
    return db;
  })().catch((error: unknown) => {
    opening = null;
    throw error;
  });
  return opening;
}

export function isLocalDbOpen(): boolean {
  return opened !== null;
}

export function getDb(): SqlDatabase {
  if (!opened) throw new Error('La base local no está abierta.');
  return opened;
}
