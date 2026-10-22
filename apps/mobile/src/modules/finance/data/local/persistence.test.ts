import type { SqlDatabase } from '@/db/types';
import { cents } from '@/lib/money';

import { accountBalance } from '../../domain/balances';
import { createAccount, updateAccount } from './accountsRepo';
import { activeList, clearMirror, hydrate, useFinanceStore } from './store';
import { accountInput, setupLocalDb, transactionInput } from './testing';
import { createTransaction, deleteTransaction } from './transactionsRepo';

type Row = Record<string, string | number | null>;

let db: SqlDatabase;

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-20T10:00:00.000Z'), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  db = await setupLocalDb();
});

afterEach(() => jest.useRealTimers());

const row = (table: string, id: string) => db.getFirstAsync<Row>(`SELECT * FROM ${table} WHERE id = ?`, [id]);

describe('repositorios sobre SQLite', () => {
  it('crear escribe la fila pendiente de subir, con fechas iguales y sin marca del servidor', async () => {
    const account = await createAccount(accountInput());
    expect(await row('accounts', account.id)).toMatchObject({
      is_dirty: 1,
      created_at: '2026-10-20T10:00:00.000Z',
      updated_at: '2026-10-20T10:00:00.000Z',
      server_updated_at: null,
      deleted_at: null,
    });
  });

  it('editar actualiza updated_at y sigue pendiente', async () => {
    const account = await createAccount(accountInput());
    await db.runAsync('UPDATE accounts SET is_dirty = 0');
    jest.setSystemTime(new Date('2026-10-20T10:05:00.000Z'));
    await updateAccount(account.id, { name: 'Nequi' });
    expect(await row('accounts', account.id)).toMatchObject({ name: 'Nequi', is_dirty: 1, updated_at: '2026-10-20T10:05:00.000Z' });
    expect(useFinanceStore.getState().accounts[account.id]?.name).toBe('Nequi');
  });

  it('borrar es lógico: la fila queda con deleted_at, pendiente, y sale de las listas', async () => {
    const account = await createAccount(accountInput());
    const tx = await createTransaction(transactionInput(account.id));
    await deleteTransaction(tx.id);
    expect(await row('transactions', tx.id)).toMatchObject({ deleted_at: '2026-10-20T10:00:00.000Z', is_dirty: 1 });
    expect(activeList(useFinanceStore.getState().transactions)).toHaveLength(0);
  });

  it('tras vaciar el espejo, hydrate lo deja igual que la base, con montos exactos', async () => {
    const account = await createAccount(accountInput({ openingBalance: cents(10) }));
    await createTransaction(transactionInput(account.id, { type: 'INCOME', amount: cents(20) }));
    const before = useFinanceStore.getState();
    clearMirror();
    expect(Object.keys(useFinanceStore.getState().accounts)).toHaveLength(0);
    await hydrate(db);
    const after = useFinanceStore.getState();
    expect(after.accounts).toEqual(before.accounts);
    expect(after.transactions).toEqual(before.transactions);
    expect(accountBalance(after.accounts[account.id]!, Object.values(after.transactions))).toBe(30);
  });
});
