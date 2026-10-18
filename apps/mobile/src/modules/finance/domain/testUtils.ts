/** Fábricas de entidades para pruebas del dominio. No usar en código de la app. */
import { localDateTimeToUtc, type IsoDate } from '@/lib/dates';
import { cents } from '@/lib/money';

import type { Account, Category, Cdt, ReimbursementGroup, Subscription, Transaction } from './types';

const T0 = '2025-01-01T00:00:00.000Z';
let counter = 0;
const nextId = (prefix: string) => `${prefix}-${++counter}`;
const sync = (id: string) => ({ id, createdAt: T0, updatedAt: T0, deletedAt: null });

export function makeAccount(over: Partial<Account> = {}): Account {
  const type = over.type ?? 'SAVINGS';
  return {
    ...sync(over.id ?? nextId('acc')),
    parentAccountId: null,
    name: 'Cuenta',
    type,
    nature: type === 'CREDIT_CARD' ? 'LIABILITY' : 'ASSET',
    currency: 'COP',
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
  };
}

export function makeCategory(over: Partial<Category> = {}): Category {
  return { ...sync(over.id ?? nextId('cat')), name: 'Categoría', kind: 'EXPENSE', icon: null, color: null, sortOrder: 0, ...over };
}

export function makeTx(over: Partial<Transaction> & { on?: IsoDate } = {}): Transaction {
  const { on, ...rest } = over;
  return {
    ...sync(rest.id ?? nextId('tx')),
    accountId: 'acc',
    counterAccountId: null,
    type: 'EXPENSE',
    amount: cents(100),
    categoryId: null,
    categorySource: 'MANUAL',
    occurredAt: on ? localDateTimeToUtc(on, 12, 0, 'America/Bogota') : '2026-10-10T17:00:00.000Z',
    description: null,
    reimbursementGroupId: null,
    subscriptionId: null,
    subscriptionPeriod: null,
    cdtId: null,
    ...rest,
  };
}

export function makeCdt(over: Partial<Cdt> = {}): Cdt {
  return {
    ...sync(over.id ?? nextId('cdt')),
    accountId: 'inv',
    issuer: 'Banco',
    certificateNumber: null,
    principal: cents(1_000_000_000),
    annualRateEa: '10.25',
    annualRateNominal: '9.80',
    termDays: 180,
    openedOn: '2026-01-01',
    maturesOn: '2026-06-30',
    interestPayment: 'AT_MATURITY',
    withholdingRate: '4.00',
    sourceAccountId: 'acc',
    payoutAccountId: null,
    status: 'ACTIVE',
    renewedFromCdtId: null,
    ...over,
  };
}

export function makeSubscription(over: Partial<Subscription> = {}): Subscription {
  return {
    ...sync(over.id ?? nextId('sub')),
    accountId: 'acc',
    categoryId: null,
    name: 'Suscripción',
    icon: null,
    amount: cents(1_000_000),
    billingCycle: 'MONTHLY',
    billingDay: 1,
    billingMonth: null,
    startDate: '2025-01-01',
    status: 'ACTIVE',
    ...over,
  };
}

export function makeGroup(over: Partial<ReimbursementGroup> = {}): ReimbursementGroup {
  return { ...sync(over.id ?? nextId('grp')), name: 'Grupo', payer: null, kind: 'REIMBURSEMENT', status: 'OPEN', notes: null, ...over };
}
