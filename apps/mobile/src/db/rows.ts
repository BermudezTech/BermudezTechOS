import { cents } from '@/lib/money';
import type { FinanceData } from '@/modules/finance/domain/types';
import { allColumns, type SyncTable } from '@/sync/tables';

import type { SqlRow } from './types';

type EntityOf<T extends SyncTable> = FinanceData[(typeof import('@/sync/tables'))['tableToEntity'][T]][string];
export type AnyEntity = FinanceData[keyof FinanceData][string];

/** Fila SQLite → entidad del dominio. Descarta `server_updated_at` e `is_dirty`. */
export function rowToEntity<T extends SyncTable>(table: T, row: SqlRow): EntityOf<T> {
  const entity: Record<string, unknown> = {};
  for (const c of allColumns(table)) {
    const value = row[c.column] ?? null;
    if (value === null) entity[c.field] = null;
    else if (c.kind === 'bool') entity[c.field] = value === 1;
    else if (c.kind === 'money') entity[c.field] = cents(Number(value));
    else if (c.kind === 'int') entity[c.field] = Number(value);
    else entity[c.field] = String(value);
  }
  return entity as unknown as EntityOf<T>;
}

/** Entidad del dominio → valores por columna (sin las columnas solo del cliente). */
export function entityToRow(table: SyncTable, entity: AnyEntity): SqlRow {
  const source = entity as unknown as Record<string, unknown>;
  const row: SqlRow = {};
  for (const c of allColumns(table)) {
    const value = source[c.field];
    if (value === null || value === undefined) row[c.column] = null;
    else if (c.kind === 'bool') row[c.column] = value ? 1 : 0;
    else row[c.column] = value as string | number;
  }
  return row;
}

/**
 * `INSERT … ON CONFLICT(id) DO UPDATE` de una fila completa, incluidas las columnas solo del
 * cliente que vengan en `extra` (`is_dirty`, `server_updated_at`).
 */
export function upsertSql(table: SyncTable, row: SqlRow): { sql: string; params: (string | number | null)[] } {
  const columns = Object.keys(row);
  const updates = columns.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`);
  return {
    sql: `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')}) ON CONFLICT(id) DO UPDATE SET ${updates.join(', ')}`,
    params: columns.map((c) => row[c] ?? null),
  };
}
