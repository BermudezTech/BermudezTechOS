import { useMemo } from 'react';

import type { Category, CategoryKind } from '../domain/types';
import { useActiveCategories } from './useFinanceData';

export { createCategory, updateCategory, type CategoryFormInput } from '../data/local/categoriesRepo';

/** Categorías activas por tipo, en su orden. */
export function useCategoriesByKind(): Record<CategoryKind, Category[]> {
  const categories = useActiveCategories();
  return useMemo(
    () => ({ EXPENSE: categories.filter((c) => c.kind === 'EXPENSE'), INCOME: categories.filter((c) => c.kind === 'INCOME') }),
    [categories],
  );
}

export function useCategory(id: string | undefined): Category | undefined {
  const categories = useActiveCategories();
  return useMemo(() => categories.find((c) => c.id === id), [categories, id]);
}
