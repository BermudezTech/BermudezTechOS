import { localDateTimeToUtc } from '@/lib/dates';

import { cdtInputSchema } from '../../domain/schemas/cdt';
import type { Account, Cdt, CdtInput, Transaction } from '../../domain/types';
import { ValidationError } from '../FinanceRepository';
import { batch, getEntity, newRecordFields, patch, useFinanceStore } from './store';
import { validate } from './validate';

function checkAccounts(input: CdtInput) {
  const accounts = useFinanceStore.getState().accounts;
  for (const [field, id] of [
    ['sourceAccountId', input.sourceAccountId],
    ['payoutAccountId', input.payoutAccountId],
  ] as const) {
    if (!id) continue;
    const account = accounts[id];
    if (!account || account.deletedAt || account.nature !== 'ASSET' || account.type === 'INVESTMENT') {
      throw new ValidationError('INVALID', field, 'Elige una cuenta de activo.');
    }
  }
}

/** Crea en una sola actualización la cuenta INVESTMENT, el CDT y la transferencia de apertura. */
export async function createCdt(input: CdtInput): Promise<Cdt> {
  const valid = validate(cdtInputSchema, input) as CdtInput;
  checkAccounts(valid);
  const accounts = useFinanceStore.getState().accounts;
  const account: Account = {
    ...newRecordFields(),
    parentAccountId: null,
    name: `CDT ${valid.issuer}`,
    type: 'INVESTMENT',
    nature: 'ASSET',
    currency: 'COP',
    icon: 'trending-up-outline',
    color: '#14B8A6',
    openingBalance: 0 as Account['openingBalance'],
    creditLimit: null,
    statementDay: null,
    paymentDueDay: null,
    isExcludedFromNetWorth: false,
    isArchived: false,
    sortOrder: Math.max(0, ...Object.values(accounts).map((a) => a.sortOrder)) + 1,
  };
  const cdt: Cdt = { ...newRecordFields(), ...valid, accountId: account.id };
  const opening: Transaction = {
    ...newRecordFields(),
    accountId: valid.sourceAccountId,
    counterAccountId: account.id,
    type: 'TRANSFER',
    amount: valid.principal,
    categoryId: null,
    categorySource: 'MANUAL',
    occurredAt: localDateTimeToUtc(valid.openedOn, 10, 0),
    description: `Apertura CDT ${valid.issuer}`,
    reimbursementGroupId: null,
    subscriptionId: null,
    subscriptionPeriod: null,
    cdtId: cdt.id,
    recurringIncomeId: null,
    recurringIncomePeriod: null,
  };
  batch((draft) => {
    draft.accounts[account.id] = account;
    draft.cdts[cdt.id] = cdt;
    draft.transactions[opening.id] = opening;
  });
  return cdt;
}

export async function updateCdt(id: string, changes: Partial<CdtInput>): Promise<Cdt> {
  const { id: _id, createdAt: _c, updatedAt: _u, deletedAt: _d, accountId: _a, ...current } = getEntity('cdts', id);
  const merged = validate(cdtInputSchema, { ...current, ...changes }) as CdtInput;
  checkAccounts(merged);
  return patch('cdts', id, merged);
}
