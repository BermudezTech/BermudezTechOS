import type { IsoDate, Period } from '@/lib/dates';

import type {
  Account,
  AccountInput,
  Asset,
  AssetInput,
  Cdt,
  CdtInput,
  GroupStatus,
  ReimbursementGroup,
  ReimbursementGroupInput,
  Subscription,
  SubscriptionInput,
  SubscriptionStatus,
  Transaction,
  TransactionInput,
  TransactionType,
} from '../domain/types';

/**
 * Contrato entre las pantallas de finanzas y la fuente de datos
 * (specs/001-finance-ui-mockup/contracts/finance-repository.md). Hoy lo implementa el store
 * en memoria; mañana una versión sobre Expo SQLite sin cambiar pantallas (FR-031).
 */

export type { Period };

export type TransactionFilter = {
  accountId?: string;
  type?: TransactionType;
  /** 'NONE' = sin categoría. */
  categoryId?: string | 'NONE';
  from?: IsoDate;
  to?: IsoDate;
  search?: string;
  reimbursementGroupId?: string;
};

export type ErrorCode =
  | 'REQUIRED'
  | 'AMOUNT_INVALID'
  | 'SAME_ACCOUNT'
  | 'CATEGORY_KIND_MISMATCH'
  | 'HAS_DEPENDENCIES'
  | 'GROUP_NOT_BALANCED'
  | 'INVALID_TRANSITION'
  | 'NOT_FOUND'
  | 'INVALID';

export class ValidationError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly field?: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'ValidationError';
  }
}

export interface FinanceRepository {
  createAccount(input: AccountInput): Promise<Account>;
  updateAccount(id: string, patch: Partial<AccountInput>): Promise<Account>;
  archiveAccount(id: string, archived: boolean): Promise<void>;
  /** Rechaza con HAS_DEPENDENCIES si tiene movimientos o cajitas (sugerir archivar). */
  deleteAccount(id: string): Promise<void>;

  createTransaction(input: TransactionInput): Promise<Transaction>;
  updateTransaction(id: string, patch: Partial<TransactionInput>): Promise<Transaction>;
  deleteTransaction(id: string): Promise<void>;
  /** Fija categorySource = 'MANUAL'. */
  setTransactionCategory(id: string, categoryId: string | null): Promise<void>;

  createSubscription(input: SubscriptionInput): Promise<Subscription>;
  updateSubscription(id: string, patch: Partial<SubscriptionInput>): Promise<Subscription>;
  setSubscriptionStatus(id: string, status: SubscriptionStatus): Promise<void>;

  createReimbursementGroup(input: ReimbursementGroupInput): Promise<ReimbursementGroup>;
  /** SETTLED solo con saldo 0. */
  setReimbursementGroupStatus(id: string, status: GroupStatus): Promise<void>;

  /** Crea también la cuenta INVESTMENT y la transferencia de apertura. */
  createCdt(input: CdtInput): Promise<Cdt>;
  updateCdt(id: string, patch: Partial<CdtInput>): Promise<Cdt>;

  createAsset(input: AssetInput): Promise<Asset>;
  updateAsset(id: string, patch: Partial<AssetInput>): Promise<Asset>;
  deleteAsset(id: string): Promise<void>;
}
