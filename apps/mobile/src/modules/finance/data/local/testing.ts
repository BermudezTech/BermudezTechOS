/** Utilidades de pruebas de la capa de datos local. No usar en la app. */
import { cents } from '@/lib/money';
import { migrate } from '@/db/schema';
import { createTestDb } from '@/db/testing/betterSqlite';
import type { SqlDatabase } from '@/db/types';
import { setLockedDb } from '@/db/writeLock';

import type { AccountInput, Category, TransactionInput } from '../../domain/types';
import { clearMirror, useFinanceStore } from './store';

/** Base SQLite en memoria, migrada y registrada en el lock, con el espejo vacío. */
export async function setupLocalDb(): Promise<SqlDatabase & { close(): void }> {
  const db = createTestDb();
  await migrate(db);
  setLockedDb(db);
  clearMirror();
  return db;
}

export const accountInput = (over: Partial<AccountInput> = {}): AccountInput => ({
  parentAccountId: null,
  name: 'Ahorros',
  type: 'SAVINGS',
  icon: null,
  color: null,
  openingBalance: cents(0),
  creditLimit: null,
  statementDay: null,
  paymentDueDay: null,
  isExcludedFromNetWorth: false,
  isArchived: false,
  sortOrder: 0,
  ...over,
});

export const transactionInput = (accountId: string, over: Partial<TransactionInput> = {}): TransactionInput => ({
  accountId,
  counterAccountId: null,
  type: 'EXPENSE',
  amount: cents(100),
  categoryId: null,
  categorySource: 'MANUAL',
  occurredAt: '2026-10-10T17:00:00.000Z',
  description: null,
  reimbursementGroupId: null,
  subscriptionId: null,
  subscriptionPeriod: null,
  cdtId: null,
  recurringIncomeId: null,
  recurringIncomePeriod: null,
  ...over,
});

/** Categoría que en la app llega del servidor: se pone directamente en el espejo. */
export function putCategory(category: Category): void {
  useFinanceStore.setState((s) => ({ categories: { ...s.categories, [category.id]: category } }));
}
