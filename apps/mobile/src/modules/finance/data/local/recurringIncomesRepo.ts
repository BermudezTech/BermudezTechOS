import { canTransition } from '../../domain/recurringIncomes';
import { recurringIncomeInputSchema } from '../../domain/schemas/recurringIncome';
import type { RecurringIncome, RecurringIncomeInput, RecurringIncomeStatus } from '../../domain/types';
import { ValidationError } from '../FinanceRepository';
import { getEntity, insert, patch, softDelete, useFinanceStore } from './store';
import { validate } from './validate';

function check(input: RecurringIncomeInput): RecurringIncomeInput {
  const valid = validate(recurringIncomeInputSchema, input) as RecurringIncomeInput;
  const state = useFinanceStore.getState();
  const account = state.accounts[valid.accountId];
  if (!account || account.deletedAt) throw new ValidationError('NOT_FOUND', 'accountId', 'La cuenta no existe.');
  if (valid.categoryId && state.categories[valid.categoryId]?.kind !== 'INCOME') {
    throw new ValidationError('CATEGORY_KIND_MISMATCH', 'categoryId', 'Elige una categoría de ingreso.');
  }
  return valid;
}

export async function createRecurringIncome(input: RecurringIncomeInput): Promise<RecurringIncome> {
  return insert('recurringIncomes', check(input));
}

/** Cambiar el valor esperado no toca los ingresos ya registrados (FR-008). */
export async function updateRecurringIncome(id: string, changes: Partial<RecurringIncomeInput>): Promise<RecurringIncome> {
  const { id: _id, createdAt: _c, updatedAt: _u, deletedAt: _d, ...current } = getEntity('recurringIncomes', id);
  return patch('recurringIncomes', id, check({ ...current, ...changes }));
}

export async function setRecurringIncomeStatus(id: string, status: RecurringIncomeStatus): Promise<void> {
  const current = getEntity('recurringIncomes', id);
  if (!canTransition(current.status, status)) throw new ValidationError('INVALID_TRANSITION', 'status', 'Cambio de estado no permitido.');
  await patch('recurringIncomes', id, { status });
}

export async function deleteRecurringIncome(id: string): Promise<void> {
  await softDelete('recurringIncomes', id);
}
