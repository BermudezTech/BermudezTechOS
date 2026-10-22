/** Parámetros de una sentencia: posicionales (`?`) o con nombre (`$name`). */
export type SqlParams = (string | number | null)[] | Record<string, string | number | null>;

/**
 * Subconjunto de `SQLiteDatabase` que usa la app (contracts/client-modules.md). Lo implementan
 * expo-sqlite y, en pruebas, el adaptador sobre better-sqlite3.
 */
export interface SqlDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: SqlParams): Promise<{ changes: number }>;
  getAllAsync<T>(sql: string, params?: SqlParams): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: SqlParams): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

/** Fila tal como la devuelve SQLite. */
export type SqlRow = Record<string, string | number | null>;
