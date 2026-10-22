import { hasDependencies } from '../../domain/accounts';
import { accountInputSchema, natureFor } from '../../domain/schemas/account';
import type { Account, AccountInput } from '../../domain/types';
import { ValidationError } from '../FinanceRepository';
import { activeList, getEntity, insert, patch, softDelete, useFinanceStore } from './store';
import { validate } from './validate';

function checkParent(input: AccountInput, selfId?: string) {
  if (!input.parentAccountId) return;
  const parent = useFinanceStore.getState().accounts[input.parentAccountId];
  if (
    !parent ||
    parent.deletedAt ||
    parent.id === selfId ||
    parent.type === 'CREDIT_CARD' ||
    parent.type === 'POCKET' ||
    parent.type === 'INVESTMENT'
  ) {
    throw new ValidationError('INVALID', 'parentAccountId', 'La cuenta principal no es válida.');
  }
}

export async function createAccount(input: AccountInput): Promise<Account> {
  const valid = validate(accountInputSchema, input) as AccountInput;
  checkParent(valid);
  // Las cuentas nuevas van al final de su grupo.
  const sortOrder = Math.max(0, ...Object.values(useFinanceStore.getState().accounts).map((a) => a.sortOrder)) + 1;
  return insert('accounts', { ...valid, sortOrder, nature: natureFor(valid.type), currency: 'COP' });
}

export async function updateAccount(id: string, changes: Partial<AccountInput>): Promise<Account> {
  const current = getEntity('accounts', id);
  const { id: _id, createdAt: _c, updatedAt: _u, deletedAt: _d, nature: _n, currency: _cur, ...currentInput } = current;
  const merged = validate(accountInputSchema, { ...currentInput, ...changes }) as AccountInput;
  checkParent(merged, id);
  return patch('accounts', id, { ...merged, nature: natureFor(merged.type) });
}

export async function archiveAccount(id: string, archived: boolean): Promise<void> {
  await patch('accounts', id, { isArchived: archived });
}

/** Rechaza con HAS_DEPENDENCIES si tiene movimientos o cajitas (la UI ofrece archivar). */
export async function deleteAccount(id: string): Promise<void> {
  const state = useFinanceStore.getState();
  if (hasDependencies(id, activeList(state.accounts), activeList(state.transactions))) {
    throw new ValidationError('HAS_DEPENDENCIES', 'id', 'La cuenta tiene movimientos o cajitas.');
  }
  await softDelete('accounts', id);
}
