import type { EntityName } from '@/modules/finance/domain/types';

/**
 * Descripción declarativa de las ocho tablas sincronizables (data-model §2–§3). La usan el
 * esquema SQLite, los conversores fila ↔ entidad, los mappers de la API y el motor de sync:
 * añadir una tabla es registrarla aquí.
 */
export const SYNC_TABLES = [
  'categories',
  'reimbursement_groups',
  'assets',
  'accounts',
  'subscriptions',
  'recurring_incomes',
  'cdts',
  'transactions',
] as const;

export type SyncTable = (typeof SYNC_TABLES)[number];

export type ColumnKind = 'text' | 'int' | 'bool' | 'money' | 'rate' | 'date' | 'datetime';

export interface ColumnDef {
  column: string;
  field: string;
  kind: ColumnKind;
  /** Admite NULL. */
  nullable?: boolean;
}

export const tableToEntity: Record<SyncTable, EntityName> = {
  categories: 'categories',
  reimbursement_groups: 'reimbursementGroups',
  assets: 'assets',
  accounts: 'accounts',
  subscriptions: 'subscriptions',
  recurring_incomes: 'recurringIncomes',
  cdts: 'cdts',
  transactions: 'transactions',
};

export const entityToTable = Object.fromEntries(Object.entries(tableToEntity).map(([t, e]) => [e, t])) as Record<EntityName, SyncTable>;

const col = (column: string, field: string, kind: ColumnKind, nullable = false): ColumnDef => ({ column, field, kind, nullable });

/** Columnas comunes que también existen en los tipos del dominio (`SyncFields`). */
export const SYNC_COLUMNS: ColumnDef[] = [
  col('id', 'id', 'text'),
  col('created_at', 'createdAt', 'datetime'),
  col('updated_at', 'updatedAt', 'datetime'),
  col('deleted_at', 'deletedAt', 'datetime', true),
];

/** Columnas solo del cliente, fuera del dominio y de la API. */
export const LOCAL_ONLY_COLUMNS = ['server_updated_at', 'is_dirty'] as const;

export const TABLE_COLUMNS: Record<SyncTable, ColumnDef[]> = {
  categories: [
    col('name', 'name', 'text'),
    col('kind', 'kind', 'text'),
    col('icon', 'icon', 'text', true),
    col('color', 'color', 'text', true),
    col('sort_order', 'sortOrder', 'int'),
  ],
  reimbursement_groups: [
    col('name', 'name', 'text'),
    col('payer', 'payer', 'text', true),
    col('kind', 'kind', 'text'),
    col('status', 'status', 'text'),
    col('notes', 'notes', 'text', true),
  ],
  assets: [col('name', 'name', 'text'), col('value', 'value', 'money'), col('valid_until', 'validUntil', 'date')],
  accounts: [
    col('parent_account_id', 'parentAccountId', 'text', true),
    col('name', 'name', 'text'),
    col('type', 'type', 'text'),
    col('nature', 'nature', 'text'),
    col('currency', 'currency', 'text'),
    col('icon', 'icon', 'text', true),
    col('color', 'color', 'text', true),
    col('opening_balance', 'openingBalance', 'money'),
    col('credit_limit', 'creditLimit', 'money', true),
    col('statement_day', 'statementDay', 'int', true),
    col('payment_due_day', 'paymentDueDay', 'int', true),
    col('is_excluded_from_net_worth', 'isExcludedFromNetWorth', 'bool'),
    col('is_archived', 'isArchived', 'bool'),
    col('sort_order', 'sortOrder', 'int'),
  ],
  subscriptions: [
    col('account_id', 'accountId', 'text'),
    col('category_id', 'categoryId', 'text', true),
    col('name', 'name', 'text'),
    col('icon', 'icon', 'text', true),
    col('amount', 'amount', 'money'),
    col('billing_cycle', 'billingCycle', 'text'),
    col('billing_day', 'billingDay', 'int'),
    col('billing_month', 'billingMonth', 'int', true),
    col('start_date', 'startDate', 'date'),
    col('status', 'status', 'text'),
  ],
  recurring_incomes: [
    col('account_id', 'accountId', 'text'),
    col('category_id', 'categoryId', 'text', true),
    col('name', 'name', 'text'),
    col('icon', 'icon', 'text', true),
    col('expected_amount', 'expectedAmount', 'money'),
    col('cycle', 'cycle', 'text'),
    col('expected_day', 'expectedDay', 'int'),
    col('expected_month', 'expectedMonth', 'int', true),
    col('start_date', 'startDate', 'date'),
    col('status', 'status', 'text'),
  ],
  cdts: [
    col('account_id', 'accountId', 'text'),
    col('issuer', 'issuer', 'text'),
    col('certificate_number', 'certificateNumber', 'text', true),
    col('principal', 'principal', 'money'),
    col('annual_rate_ea', 'annualRateEa', 'rate'),
    col('annual_rate_nominal', 'annualRateNominal', 'rate'),
    col('term_days', 'termDays', 'int'),
    col('opened_on', 'openedOn', 'date'),
    col('matures_on', 'maturesOn', 'date'),
    col('interest_payment', 'interestPayment', 'text'),
    col('withholding_rate', 'withholdingRate', 'rate'),
    col('source_account_id', 'sourceAccountId', 'text'),
    col('payout_account_id', 'payoutAccountId', 'text', true),
    col('status', 'status', 'text'),
    col('renewed_from_cdt_id', 'renewedFromCdtId', 'text', true),
  ],
  transactions: [
    col('account_id', 'accountId', 'text'),
    col('counter_account_id', 'counterAccountId', 'text', true),
    col('type', 'type', 'text'),
    col('amount', 'amount', 'money'),
    col('category_id', 'categoryId', 'text', true),
    col('category_source', 'categorySource', 'text'),
    col('occurred_at', 'occurredAt', 'datetime'),
    col('description', 'description', 'text', true),
    col('reimbursement_group_id', 'reimbursementGroupId', 'text', true),
    col('subscription_id', 'subscriptionId', 'text', true),
    col('subscription_period', 'subscriptionPeriod', 'text', true),
    col('recurring_income_id', 'recurringIncomeId', 'text', true),
    col('recurring_income_period', 'recurringIncomePeriod', 'text', true),
    col('cdt_id', 'cdtId', 'text', true),
  ],
};

/** Comunes + datos, en el orden de las columnas de la tabla. */
export function allColumns(table: SyncTable): ColumnDef[] {
  return [...SYNC_COLUMNS, ...TABLE_COLUMNS[table]];
}

/** Referencias entre tablas (data-model §3): orden del PUSH y dependientes al descartar. */
export const REFERENCES: Record<SyncTable, { column: string; table: SyncTable }[]> = {
  categories: [],
  reimbursement_groups: [],
  assets: [],
  accounts: [{ column: 'parent_account_id', table: 'accounts' }],
  subscriptions: [
    { column: 'account_id', table: 'accounts' },
    { column: 'category_id', table: 'categories' },
  ],
  recurring_incomes: [
    { column: 'account_id', table: 'accounts' },
    { column: 'category_id', table: 'categories' },
  ],
  cdts: [
    { column: 'account_id', table: 'accounts' },
    { column: 'source_account_id', table: 'accounts' },
    { column: 'payout_account_id', table: 'accounts' },
    { column: 'renewed_from_cdt_id', table: 'cdts' },
  ],
  transactions: [
    { column: 'account_id', table: 'accounts' },
    { column: 'counter_account_id', table: 'accounts' },
    { column: 'category_id', table: 'categories' },
    { column: 'reimbursement_group_id', table: 'reimbursement_groups' },
    { column: 'subscription_id', table: 'subscriptions' },
    { column: 'recurring_income_id', table: 'recurring_incomes' },
    { column: 'cdt_id', table: 'cdts' },
  ],
};
