import { useCallback, useMemo } from 'react';

import { useFinanceStore } from '../data/local/store';
import { sortRecurringIncomes } from '../domain/recurringIncomes';
import type { RecurringIncome } from '../domain/types';
import { useActiveRecurringIncomes } from './useFinanceData';

export {
  createRecurringIncome,
  deleteRecurringIncome,
  setRecurringIncomeStatus,
  updateRecurringIncome,
} from '../data/local/recurringIncomesRepo';

/** Plantillas no borradas: activas primero. */
export function useRecurringIncomes() {
  const items = useActiveRecurringIncomes();
  return useMemo(() => sortRecurringIncomes(items), [items]);
}

/** Solo las activas: las que ofrece el selector del formulario de ingreso. */
export function useSelectableRecurringIncomes() {
  const items = useRecurringIncomes();
  return useMemo(() => items.filter((r) => r.status === 'ACTIVE'), [items]);
}

export function useRecurringIncome(id: string | undefined) {
  const items = useActiveRecurringIncomes();
  return useMemo(() => items.find((r) => r.id === id), [items, id]);
}

/** Todas las plantillas, incluidas pausadas y borradas: para resolver el vínculo de ingresos ya registrados. */
export function useRecurringIncomeLookup() {
  const records = useFinanceStore((s) => s.recurringIncomes);
  return useCallback((id: string): RecurringIncome | undefined => records[id], [records]);
}
