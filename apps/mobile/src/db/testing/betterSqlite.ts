/** Adaptador de pruebas: `SqlDatabase` sobre better-sqlite3 en memoria (research R16). No usar en la app. */
import Database from 'better-sqlite3';

import type { SqlDatabase, SqlParams } from '../types';

/** better-sqlite3 usa `@name`/`$name` sin el prefijo en el objeto; expo-sqlite lo incluye. */
function normalize(params?: SqlParams): unknown[] {
  if (params === undefined) return [];
  if (Array.isArray(params)) return params;
  return [Object.fromEntries(Object.entries(params).map(([k, v]) => [k.replace(/^[$:@]/, ''), v]))];
}

export function createTestDb(): SqlDatabase & { close(): void } {
  const raw = new Database(':memory:');
  return {
    async execAsync(sql) {
      raw.exec(sql);
    },
    async runAsync(sql, params) {
      const info = raw.prepare(sql).run(...normalize(params));
      return { changes: info.changes };
    },
    async getAllAsync<T>(sql: string, params?: SqlParams) {
      return raw.prepare(sql).all(...normalize(params)) as T[];
    },
    async getFirstAsync<T>(sql: string, params?: SqlParams) {
      const stmt = raw.prepare(sql);
      return ((stmt.reader ? stmt.get(...normalize(params)) : undefined) ?? null) as T | null;
    },
    async withTransactionAsync(task) {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
    close() {
      raw.close();
    },
  };
}
