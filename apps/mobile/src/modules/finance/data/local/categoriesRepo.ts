import { isDuplicateCategoryName, nextSortOrder } from '../../domain/categories';
import { categoryInputSchema } from '../../domain/schemas/category';
import type { Category, CategoryKind } from '../../domain/types';
import { ValidationError } from '../FinanceRepository';
import { activeList, getEntity, insert, patch, useFinanceStore } from './store';
import { validate } from './validate';

export type CategoryFormInput = { name: string; kind: CategoryKind; icon: string; color: string };

const KIND_LABEL: Record<CategoryKind, string> = { EXPENSE: 'egreso', INCOME: 'ingreso' };

function assertUniqueName(name: string, kind: CategoryKind, exceptId?: string): void {
  const categories = activeList(useFinanceStore.getState().categories);
  if (isDuplicateCategoryName(name, kind, categories, exceptId)) {
    throw new ValidationError('DUPLICATE_NAME', 'name', `Ya tienes una categoría de ${KIND_LABEL[kind]} llamada «${name.trim()}».`);
  }
}

export async function createCategory(input: CategoryFormInput): Promise<Category> {
  const data = validate(categoryInputSchema(), input);
  assertUniqueName(data.name, data.kind);
  const sortOrder = nextSortOrder(data.kind, activeList(useFinanceStore.getState().categories));
  return insert('categories', { ...data, sortOrder });
}

/** Edita nombre, ícono y color; el tipo no cambia (FR-013). No hay borrado (Clarifications 2026-10-31). */
export async function updateCategory(id: string, changes: Partial<Pick<CategoryFormInput, 'name' | 'icon' | 'color'>>): Promise<Category> {
  const current = getEntity('categories', id);
  const data = validate(categoryInputSchema(current), {
    name: changes.name ?? current.name,
    kind: current.kind,
    icon: changes.icon ?? current.icon ?? '',
    color: changes.color ?? current.color ?? '',
  });
  assertUniqueName(data.name, current.kind, id);
  return patch('categories', id, { name: data.name, icon: data.icon, color: data.color });
}
