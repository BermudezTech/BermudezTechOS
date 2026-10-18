import { create } from 'zustand';

import { nowUtc, todayLocal } from '@/lib/dates';
import { newId } from '@/lib/ids';

import type { EntityName, FinanceData, SyncFields } from '../../domain/types';
import { ValidationError } from '../FinanceRepository';
import { buildSeed, type SeedMode } from '../mock/seed';

/**
 * Store en memoria (research R4). Solo lo usan las implementaciones de repositorio y los
 * hooks; las pantallas nunca lo importan (regla de ESLint). Los cambios se pierden al
 * recargar (FR-032).
 */
export type FinanceState = FinanceData & { seedMode: SeedMode };

export const useFinanceStore = create<FinanceState>(() => ({ ...buildSeed('full', todayLocal()), seedMode: 'full' }));

type EntityOf<E extends EntityName> = FinanceData[E][string];

export function resetMockData(mode: SeedMode): void {
  useFinanceStore.setState({ ...buildSeed(mode, todayLocal()), seedMode: mode });
}

export function getEntity<E extends EntityName>(entity: E, id: string): EntityOf<E> {
  const record = (useFinanceStore.getState()[entity] as Record<string, EntityOf<E>>)[id];
  if (!record || record.deletedAt) throw new ValidationError('NOT_FOUND', 'id');
  return record;
}

export function activeList<T extends SyncFields>(records: Record<string, T>): T[] {
  return Object.values(records).filter((r) => !r.deletedAt);
}

/** Inserta una entidad nueva asignando id y marcas de tiempo UTC. */
export function insert<E extends EntityName>(entity: E, input: Omit<EntityOf<E>, keyof SyncFields>): EntityOf<E> {
  const at = nowUtc();
  const record = { ...input, id: newId(), createdAt: at, updatedAt: at, deletedAt: null } as EntityOf<E>;
  useFinanceStore.setState((s) => ({ [entity]: { ...s[entity], [record.id]: record } }) as Partial<FinanceState>);
  return record;
}

/** Aplica cambios y actualiza `updatedAt`. */
export function patch<E extends EntityName>(entity: E, id: string, changes: Partial<EntityOf<E>>): EntityOf<E> {
  const current = getEntity(entity, id);
  const record = { ...current, ...changes, id, updatedAt: nowUtc() } as EntityOf<E>;
  useFinanceStore.setState((s) => ({ [entity]: { ...s[entity], [id]: record } }) as Partial<FinanceState>);
  return record;
}

/** Borrado lógico. */
export function softDelete(entity: EntityName, id: string): void {
  getEntity(entity, id);
  const at = nowUtc();
  useFinanceStore.setState((s) => {
    const current = (s[entity] as Record<string, SyncFields>)[id]!;
    return { [entity]: { ...s[entity], [id]: { ...current, deletedAt: at, updatedAt: at } } } as Partial<FinanceState>;
  });
}

/** Aplica varias escrituras en una sola actualización del store. */
export function batch(mutate: (draft: FinanceData) => void): void {
  useFinanceStore.setState((s) => {
    const draft: FinanceData = {
      accounts: { ...s.accounts },
      categories: { ...s.categories },
      transactions: { ...s.transactions },
      subscriptions: { ...s.subscriptions },
      recurringIncomes: { ...s.recurringIncomes },
      reimbursementGroups: { ...s.reimbursementGroups },
      cdts: { ...s.cdts },
      assets: { ...s.assets },
    };
    mutate(draft);
    return draft;
  });
}

export function newRecordFields(): SyncFields {
  const at = nowUtc();
  return { id: newId(), createdAt: at, updatedAt: at, deletedAt: null };
}
