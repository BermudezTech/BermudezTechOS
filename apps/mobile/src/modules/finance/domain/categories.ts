import type { Category, CategoryKind } from './types';

/** Para comparar nombres: sin espacios extremos ni repetidos, sin tildes y en minúsculas (FR-014). */
export function normalizeCategoryName(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/** ¿Hay otra categoría activa del mismo tipo con el mismo nombre normalizado? */
export function isDuplicateCategoryName(name: string, kind: CategoryKind, categories: Category[], exceptId?: string): boolean {
  const target = normalizeCategoryName(name);
  return categories.some((c) => !c.deletedAt && c.kind === kind && c.id !== exceptId && normalizeCategoryName(c.name) === target);
}

/** Las categorías nuevas van al final de su tipo. */
export function nextSortOrder(kind: CategoryKind, categories: Category[]): number {
  const orders = categories.filter((c) => !c.deletedAt && c.kind === kind).map((c) => c.sortOrder);
  return orders.length === 0 ? 0 : Math.max(...orders) + 1;
}
