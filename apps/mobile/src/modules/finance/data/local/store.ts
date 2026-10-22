import { create } from 'zustand';

import { emitLocalChange } from '@/db/localChanges';
import { entityToRow, rowToEntity, upsertSql, type AnyEntity } from '@/db/rows';
import type { SqlDatabase, SqlRow } from '@/db/types';
import { withWriteLock } from '@/db/writeLock';
import { nowUtc } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { entityToTable, SYNC_TABLES, tableToEntity } from '@/sync/tables';

import type { EntityName, FinanceData, SyncFields } from '../../domain/types';
import { ValidationError } from '../FinanceRepository';

/**
 * Espejo en memoria de la base local (research R2). SQLite es la fuente de verdad: toda
 * escritura se confirma primero en la base (con `is_dirty = 1`) y solo después se refleja aquí.
 * Las pantallas nunca lo importan (regla de ESLint); lo leen los hooks de forma síncrona.
 */
export type FinanceState = FinanceData;

function emptyData(): FinanceData {
  return {
    accounts: {},
    categories: {},
    transactions: {},
    subscriptions: {},
    recurringIncomes: {},
    reimbursementGroups: {},
    cdts: {},
    assets: {},
  };
}

export const useFinanceStore = create<FinanceState>(() => emptyData());

type EntityOf<E extends EntityName> = FinanceData[E][string];

let hydrated = false;

/** Carga las ocho tablas al espejo en una sola actualización. */
export async function hydrate(db: SqlDatabase): Promise<void> {
  const data = emptyData();
  for (const table of SYNC_TABLES) {
    const rows = await db.getAllAsync<SqlRow>(`SELECT * FROM ${table}`);
    const target = data[tableToEntity[table]] as Record<string, AnyEntity>;
    for (const row of rows) target[row.id as string] = rowToEntity(table, row);
  }
  useFinanceStore.setState(data, true);
  hydrated = true;
}

export function isHydrated(): boolean {
  return hydrated;
}

export function clearMirror(): void {
  useFinanceStore.setState(emptyData(), true);
  hydrated = false;
}

/** Refleja registros ya confirmados en SQLite (motor de sync). */
export function applyRows(entity: EntityName, records: AnyEntity[]): void {
  if (records.length === 0) return;
  useFinanceStore.setState(
    (s) => ({ [entity]: { ...s[entity], ...Object.fromEntries(records.map((r) => [r.id, r])) } }) as Partial<FinanceState>,
  );
}

/** Quita registros borrados físicamente de la base (descartar un registro nunca subido). */
export function removeRows(entity: EntityName, ids: string[]): void {
  if (ids.length === 0) return;
  useFinanceStore.setState((s) => {
    const next = { ...s[entity] } as Record<string, AnyEntity>;
    for (const id of ids) delete next[id];
    return { [entity]: next } as Partial<FinanceState>;
  });
}

export function getEntity<E extends EntityName>(entity: E, id: string): EntityOf<E> {
  const record = (useFinanceStore.getState()[entity] as Record<string, EntityOf<E>>)[id];
  if (!record || record.deletedAt) throw new ValidationError('NOT_FOUND', 'id');
  return record;
}

export function activeList<T extends SyncFields>(records: Record<string, T>): T[] {
  return Object.values(records).filter((r) => !r.deletedAt);
}

type Change = { entity: EntityName; record: AnyEntity };

/**
 * Guarda los cambios en una transacción marcándolos pendientes de subir y, solo si confirma,
 * los refleja en el espejo y avisa al planificador de sync.
 */
async function persist(changes: Change[]): Promise<void> {
  await withWriteLock(async (db) => {
    for (const { entity, record } of changes) {
      const table = entityToTable[entity];
      const { sql, params } = upsertSql(table, { ...entityToRow(table, record), is_dirty: 1 });
      await db.runAsync(sql, params);
    }
  });
  useFinanceStore.setState((s) => {
    const next: Partial<FinanceState> = {};
    for (const { entity, record } of changes) {
      (next as Record<string, Record<string, AnyEntity>>)[entity] = {
        ...((next[entity] ?? s[entity]) as Record<string, AnyEntity>),
        [record.id]: record,
      };
    }
    return next;
  });
  emitLocalChange();
}

/** Inserta una entidad nueva asignando id y marcas de tiempo UTC. */
export async function insert<E extends EntityName>(entity: E, input: Omit<EntityOf<E>, keyof SyncFields>): Promise<EntityOf<E>> {
  const at = nowUtc();
  const record = { ...input, id: newId(), createdAt: at, updatedAt: at, deletedAt: null } as EntityOf<E>;
  await persist([{ entity, record }]);
  return record;
}

/** Aplica cambios y actualiza `updatedAt`. */
export async function patch<E extends EntityName>(entity: E, id: string, changes: Partial<EntityOf<E>>): Promise<EntityOf<E>> {
  const current = getEntity(entity, id);
  const record = { ...current, ...changes, id, updatedAt: nowUtc() } as EntityOf<E>;
  await persist([{ entity, record }]);
  return record;
}

/** Borrado lógico. */
export async function softDelete(entity: EntityName, id: string): Promise<void> {
  const current = getEntity(entity, id);
  const at = nowUtc();
  await persist([{ entity, record: { ...current, deletedAt: at, updatedAt: at } }]);
}

/**
 * Varias escrituras atómicas (FR-011): `mutate` modifica un borrador; se guardan en una sola
 * transacción los registros nuevos o reemplazados. A los existentes se les actualiza `updatedAt`.
 */
export async function batch(mutate: (draft: FinanceData) => void): Promise<void> {
  const state = useFinanceStore.getState();
  const draft = Object.fromEntries((Object.keys(state) as EntityName[]).map((e) => [e, { ...state[e] }])) as unknown as FinanceData;
  mutate(draft);
  const at = nowUtc();
  const changes: Change[] = [];
  for (const entity of Object.keys(draft) as EntityName[]) {
    const before = state[entity] as Record<string, AnyEntity>;
    for (const [id, record] of Object.entries(draft[entity] as Record<string, AnyEntity>)) {
      const previous = before[id];
      if (previous === record) continue;
      changes.push({ entity, record: previous && previous.updatedAt === record.updatedAt ? { ...record, updatedAt: at } : record });
    }
  }
  if (changes.length > 0) await persist(changes);
}

export function newRecordFields(): SyncFields {
  const at = nowUtc();
  return { id: newId(), createdAt: at, updatedAt: at, deletedAt: null };
}
