import type { SqlDatabase } from '@/db/types';
import { cents } from '@/lib/money';

import { makeCategory } from '../../domain/testUtils';
import { createAccount } from './accountsRepo';
import { createCdt } from './cdtsRepo';
import { useFinanceStore } from './store';
import { accountInput, putCategory, setupLocalDb, transactionInput } from './testing';
import { createTransaction } from './transactionsRepo';

let db: SqlDatabase;

beforeEach(async () => {
  db = await setupLocalDb();
});

const count = async (table: string) => (await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))!.n;

describe('atomicidad (FR-011)', () => {
  it('una escritura de varios registros que falla a mitad no deja nada en la base ni en el espejo', async () => {
    const source = await createAccount(accountInput());
    const original = db.runAsync.bind(db);
    let calls = 0;
    // El CDT escribe cuenta INVESTMENT + CDT + transferencia: falla la segunda escritura.
    db.runAsync = async (sql, params) => {
      if (/^INSERT INTO/.test(sql) && ++calls === 2) throw new Error('disco lleno');
      return original(sql, params);
    };
    await expect(
      createCdt({
        issuer: 'Banco',
        certificateNumber: null,
        principal: cents(100_000_00),
        annualRateEa: '10.25',
        annualRateNominal: '9.80',
        termDays: 180,
        openedOn: '2026-01-01',
        maturesOn: '2026-06-30',
        interestPayment: 'AT_MATURITY',
        withholdingRate: '4.00',
        sourceAccountId: source.id,
        payoutAccountId: null,
        status: 'ACTIVE',
        renewedFromCdtId: null,
      }),
    ).rejects.toThrow('disco lleno');
    db.runAsync = original;
    expect(await count('accounts')).toBe(1);
    expect(await count('cdts')).toBe(0);
    expect(await count('transactions')).toBe(0);
    const state = useFinanceStore.getState();
    expect(Object.keys(state.accounts)).toEqual([source.id]);
    expect(Object.keys(state.cdts)).toHaveLength(0);
  });

  it('los errores de validación no escriben nada', async () => {
    const account = await createAccount(accountInput());
    const income = makeCategory({ id: 'cat-income', kind: 'INCOME' });
    putCategory(income);
    await expect(createTransaction(transactionInput(account.id, { type: 'TRANSFER', counterAccountId: account.id }))).rejects.toMatchObject(
      {
        code: 'SAME_ACCOUNT',
      },
    );
    await expect(createTransaction(transactionInput(account.id, { amount: cents(0) }))).rejects.toMatchObject({ code: 'AMOUNT_INVALID' });
    await expect(createTransaction(transactionInput(account.id, { categoryId: income.id }))).rejects.toMatchObject({
      code: 'CATEGORY_KIND_MISMATCH',
    });
    expect(await count('transactions')).toBe(0);
    expect(Object.keys(useFinanceStore.getState().transactions)).toHaveLength(0);
  });
});
