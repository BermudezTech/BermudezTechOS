import { entityToRow, type AnyEntity } from '@/db/rows';
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

import { fromWire, ParseError, toWire } from './mappers';
import { SYNC_TABLES, type SyncTable } from './tables';

const samples: Record<SyncTable, AnyEntity> = {
  categories: makeCategory(),
  reimbursement_groups: makeGroup(),
  assets: makeAsset({ value: cents(10) }),
  accounts: makeAccount({ openingBalance: cents(20), isExcludedFromNetWorth: true }),
  subscriptions: makeSubscription(),
  recurring_incomes: makeRecurringIncome(),
  cdts: makeCdt({ annualRateEa: '10.2500', principal: cents(99_999_999_999_999) }),
  transactions: makeTx({ amount: cents(30) }),
};

describe('mappers', () => {
  it.each(SYNC_TABLES)('ida y vuelta fila → API → fila: %s', (table) => {
    const row = { ...entityToRow(table, samples[table]), is_dirty: 1, server_updated_at: null };
    const wire = toWire(table, row);
    expect(wire).not.toHaveProperty('isDirty');
    expect(wire).not.toHaveProperty('serverUpdatedAt');
    expect(wire).not.toHaveProperty('userId');
    const back = fromWire(table, { ...JSON.parse(JSON.stringify(wire)), serverUpdatedAt: '2026-10-20T12:00:00.000123Z', userId: 'x' });
    expect(back).toEqual({ ...row, is_dirty: 0, server_updated_at: '2026-10-20T12:00:00.000123Z' });
  });

  it('montos como string exacto, booleanos como booleanos y tasas sin tocar', () => {
    const account = toWire('accounts', entityToRow('accounts', samples.accounts));
    expect(account.openingBalance).toBe('0.20');
    expect(account.isExcludedFromNetWorth).toBe(true);
    const cdt = toWire('cdts', entityToRow('cdts', samples.cdts));
    expect(cdt.principal).toBe('999999999999.99');
    expect(cdt.annualRateEa).toBe('10.2500');
  });

  it('normaliza las fechas sin milisegundos del servidor', () => {
    const wire = { ...toWire('categories', entityToRow('categories', samples.categories)), updatedAt: '2026-10-20T14:00:00Z' };
    expect(fromWire('categories', wire).updated_at).toBe('2026-10-20T14:00:00.000Z');
  });

  it('lanza ParseError con un monto mal formado o un campo obligatorio ausente', () => {
    const wire = toWire('transactions', entityToRow('transactions', samples.transactions));
    expect(() => fromWire('transactions', { ...wire, amount: '1.234' })).toThrow(ParseError);
    expect(() => fromWire('transactions', { ...wire, amount: 12.5 })).toThrow(ParseError);
    const { accountId: _omit, ...missing } = wire;
    expect(() => fromWire('transactions', missing)).toThrow(ParseError);
    expect(() => fromWire('transactions', { ...wire, occurredAt: 'ayer' })).toThrow(ParseError);
  });
});
