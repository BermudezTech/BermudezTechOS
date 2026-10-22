import { cents } from '@/lib/money';
import {
  makeAccount,
  makeAsset,
  makeCategory,
  makeCdt,
  makeGroup,
  makeRecurringIncome,
  makeSubscription,
  makeTx,
} from '@/modules/finance/domain/testUtils';
import { SYNC_TABLES, type SyncTable } from '@/sync/tables';

import { entityToRow, rowToEntity, upsertSql, type AnyEntity } from './rows';
import { migrate } from './schema';
import { createTestDb } from './testing/betterSqlite';

const samples: Record<SyncTable, AnyEntity> = {
  categories: makeCategory({ icon: 'cart' }),
  reimbursement_groups: makeGroup(),
  assets: makeAsset({ value: cents(10) }),
  accounts: makeAccount({ openingBalance: cents(20), creditLimit: null, isArchived: true }),
  subscriptions: makeSubscription(),
  recurring_incomes: makeRecurringIncome(),
  cdts: makeCdt({ principal: cents(99_999_999_999_999), annualRateEa: '10.2500' }),
  transactions: makeTx({ amount: cents(10), deletedAt: '2026-10-20T10:00:00.000Z' }),
};

describe('rowToEntity / entityToRow', () => {
  it.each(SYNC_TABLES)('ida y vuelta por SQLite sin cambios: %s', async (table) => {
    const db = createTestDb();
    await migrate(db);
    const { sql, params } = upsertSql(table, { ...entityToRow(table, samples[table]), is_dirty: 1 });
    await db.runAsync(sql, params);
    const row = await db.getFirstAsync<Record<string, string | number | null>>(`SELECT * FROM ${table}`);
    expect(rowToEntity(table, row!)).toEqual(samples[table]);
  });

  it('convierte booleanos a 0/1 y conserva montos y nulos', () => {
    const row = entityToRow('accounts', samples.accounts);
    expect(row.is_archived).toBe(1);
    expect(row.is_excluded_from_net_worth).toBe(0);
    expect(row.opening_balance).toBe(20);
    expect(row.credit_limit).toBeNull();
  });
});
