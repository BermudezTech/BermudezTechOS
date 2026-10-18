import { transactionInputSchema } from '../../domain/schemas/transaction';
import type { Transaction, TransactionInput } from '../../domain/types';
import { ValidationError } from '../FinanceRepository';
import { getEntity, insert, patch, softDelete, useFinanceStore } from './store';
import { validate } from './validate';

function normalize(input: TransactionInput): TransactionInput {
  // Las transferencias no llevan categoría ni grupo (data-model).
  return input.type === 'TRANSFER' ? { ...input, categoryId: null, reimbursementGroupId: null } : { ...input, counterAccountId: null };
}

function check(input: TransactionInput, { creating }: { creating: boolean }): TransactionInput {
  const state = useFinanceStore.getState();
  const categories = new Map(Object.values(state.categories).map((c) => [c.id, c]));
  const valid = validate(transactionInputSchema(categories), normalize(input)) as TransactionInput;
  for (const [field, id] of [
    ['accountId', valid.accountId],
    ['counterAccountId', valid.counterAccountId],
  ] as const) {
    if (!id) continue;
    const account = state.accounts[id];
    if (!account || account.deletedAt) throw new ValidationError('NOT_FOUND', field, 'La cuenta no existe.');
    if (creating && account.isArchived) throw new ValidationError('INVALID', field, 'La cuenta está archivada.');
  }
  if (valid.reimbursementGroupId) {
    const group = state.reimbursementGroups[valid.reimbursementGroupId];
    if (!group || group.deletedAt) throw new ValidationError('NOT_FOUND', 'reimbursementGroupId', 'El grupo no existe.');
  }
  if (valid.recurringIncomeId) {
    if (valid.type !== 'INCOME') {
      throw new ValidationError('RECURRING_INCOME_TYPE', 'recurringIncomeId', 'Solo los ingresos se asocian a un ingreso recurrente.');
    }
    // Los históricos pueden apuntar a una plantilla borrada (FR-009).
    if (!state.recurringIncomes[valid.recurringIncomeId]) {
      throw new ValidationError('NOT_FOUND', 'recurringIncomeId', 'El ingreso recurrente no existe.');
    }
  }
  if (!valid.recurringIncomeId !== !valid.recurringIncomePeriod) {
    throw new ValidationError('INVALID_PERIOD', 'recurringIncomePeriod', 'Falta el periodo del ingreso recurrente.');
  }
  return valid;
}

export async function createTransaction(input: TransactionInput): Promise<Transaction> {
  return insert('transactions', check(input, { creating: true }));
}

export async function updateTransaction(id: string, changes: Partial<TransactionInput>): Promise<Transaction> {
  const { id: _id, createdAt: _c, updatedAt: _u, deletedAt: _d, ...current } = getEntity('transactions', id);
  return patch('transactions', id, check({ ...current, ...changes }, { creating: false }));
}

export async function deleteTransaction(id: string): Promise<void> {
  softDelete('transactions', id);
}

/** Confirmar o cambiar la categoría la marca como MANUAL (FR-020). */
export async function setTransactionCategory(id: string, categoryId: string | null): Promise<void> {
  await updateTransaction(id, { categoryId, categorySource: 'MANUAL' });
}
