import type { IsoDate, IsoDateTime } from '@/lib/dates';
import type { Cents } from '@/lib/money';

/**
 * Modelo del cliente (specs/001-finance-ui-mockup/data-model.md). Refleja el esquema lógico
 * de docs/db-finanzas.md en camelCase. No hay `userId`: lo asigna el servidor (Principio III).
 */
export interface SyncFields {
  id: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  /** Borrado lógico: las consultas lo excluyen. */
  deletedAt: IsoDateTime | null;
}

export type Currency = 'COP';

export type AccountType = 'CHECKING' | 'SAVINGS' | 'CASH' | 'CREDIT_CARD' | 'POCKET' | 'INVESTMENT';
export type AccountNature = 'ASSET' | 'LIABILITY';

export interface AccountInput {
  parentAccountId: string | null;
  name: string;
  type: AccountType;
  icon: string | null;
  color: string | null;
  /** En tarjetas = deuda inicial. */
  openingBalance: Cents;
  creditLimit: Cents | null;
  statementDay: number | null;
  paymentDueDay: number | null;
  isExcludedFromNetWorth: boolean;
  isArchived: boolean;
  sortOrder: number;
}

export interface Account extends SyncFields, AccountInput {
  /** Derivada del tipo; no editable. */
  nature: AccountNature;
  currency: Currency;
}

export type CategoryKind = 'INCOME' | 'EXPENSE';

export interface CategoryInput {
  name: string;
  kind: CategoryKind;
  icon: string | null;
  color: string | null;
  sortOrder: number;
}

export interface Category extends SyncFields, CategoryInput {}

export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER';
export type CategorySource = 'MANUAL' | 'AI';

export interface TransactionInput {
  accountId: string;
  counterAccountId: string | null;
  type: TransactionType;
  amount: Cents;
  categoryId: string | null;
  categorySource: CategorySource;
  occurredAt: IsoDateTime;
  description: string | null;
  reimbursementGroupId: string | null;
  subscriptionId: string | null;
  subscriptionPeriod: string | null;
  cdtId: string | null;
}

export interface Transaction extends SyncFields, TransactionInput {}

export type BillingCycle = 'MONTHLY' | 'YEARLY';
export type SubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED';

export interface SubscriptionInput {
  accountId: string;
  categoryId: string | null;
  name: string;
  icon: string | null;
  amount: Cents;
  billingCycle: BillingCycle;
  billingDay: number;
  billingMonth: number | null;
  startDate: IsoDate;
  status: SubscriptionStatus;
}

export interface Subscription extends SyncFields, SubscriptionInput {}

export type ReimbursementKind = 'REIMBURSEMENT' | 'ADVANCE';
export type GroupStatus = 'OPEN' | 'SUBMITTED' | 'SETTLED';

export interface ReimbursementGroupInput {
  name: string;
  payer: string | null;
  kind: ReimbursementKind;
  status: GroupStatus;
  notes: string | null;
}

export interface ReimbursementGroup extends SyncFields, ReimbursementGroupInput {}

export type InterestPayment = 'AT_MATURITY' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL';
export type CdtStatus = 'ACTIVE' | 'MATURED' | 'RENEWED' | 'CANCELLED';

export interface CdtInput {
  issuer: string;
  certificateNumber: string | null;
  principal: Cents;
  /** Porcentaje decimal como string, p. ej. "10.2500". */
  annualRateEa: string;
  annualRateNominal: string;
  termDays: number;
  openedOn: IsoDate;
  maturesOn: IsoDate;
  interestPayment: InterestPayment;
  /** Porcentaje decimal, por defecto "4.00". */
  withholdingRate: string;
  sourceAccountId: string;
  payoutAccountId: string | null;
  status: CdtStatus;
  renewedFromCdtId: string | null;
}

export interface Cdt extends SyncFields, CdtInput {
  /** Cuenta INVESTMENT 1:1. */
  accountId: string;
}

export interface AssetInput {
  name: string;
  value: Cents;
  validUntil: IsoDate;
}

export interface Asset extends SyncFields, AssetInput {}

/** Estado completo de datos de finanzas (en memoria en esta fase). */
export interface FinanceData {
  accounts: Record<string, Account>;
  categories: Record<string, Category>;
  transactions: Record<string, Transaction>;
  subscriptions: Record<string, Subscription>;
  reimbursementGroups: Record<string, ReimbursementGroup>;
  cdts: Record<string, Cdt>;
  assets: Record<string, Asset>;
}

export type EntityName = keyof FinanceData;
