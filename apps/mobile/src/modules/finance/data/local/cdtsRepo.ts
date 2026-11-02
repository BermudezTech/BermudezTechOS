import { formatDateLocal, localDateTimeToUtc, nowUtc, todayLocal, type IsoDate } from '@/lib/dates';
import { CDT_ID_NAMESPACE, uuidV5 } from '@/lib/ids';
import type { Cents } from '@/lib/money';

import { canRenew, cdtOrigin, liveSuccessor, renewalPrincipal } from '../../domain/cdts';
import { nominalRate, settlement } from '../../domain/cdtValuation';
import { cdtInputSchema } from '../../domain/schemas/cdt';
import type { Account, Cdt, CdtInput, CdtRenewalInput, FinanceData, SyncFields, Transaction } from '../../domain/types';
import { ValidationError } from '../FinanceRepository';
import { batch, getEntity, newRecordFields, useFinanceStore } from './store';
import { validate } from './validate';

/** IDs deterministas de la renovación (research R6): dos dispositivos convergen por LWW. */
export const renewalIds = (previousId: string) => {
  const cdtId = uuidV5(CDT_ID_NAMESPACE, `${previousId}:renewal`);
  return {
    cdtId,
    interestId: uuidV5(CDT_ID_NAMESPACE, `${previousId}:interest`),
    adjustmentId: uuidV5(CDT_ID_NAMESPACE, `${cdtId}:adjustment`),
    differenceId: uuidV5(CDT_ID_NAMESPACE, `${cdtId}:difference`),
  };
};

function checkAssetAccount(field: string, id: string | null) {
  if (!id) return;
  const account = useFinanceStore.getState().accounts[id];
  if (!account || account.deletedAt || account.nature !== 'ASSET' || account.type === 'INVESTMENT' || account.type === 'POCKET') {
    throw new ValidationError('INVALID', field, 'Elige una cuenta de activo.');
  }
}

function checkAccounts(input: CdtInput) {
  checkAssetAccount('sourceAccountId', input.sourceAccountId);
  checkAssetAccount('payoutAccountId', input.payoutAccountId);
}

/** Valida y fija la tasa nominal derivada (FR-010): nunca viene del formulario. */
function prepare(input: CdtInput): CdtInput {
  const valid = validate(cdtInputSchema, input) as CdtInput;
  checkAccounts(valid);
  return { ...valid, annualRateNominal: nominalRate(valid) };
}

const liveCdts = () => Object.values(useFinanceStore.getState().cdts).filter((c) => !c.deletedAt);
const liveTransactions = () => Object.values(useFinanceStore.getState().transactions).filter((t) => !t.deletedAt);

const baseTransaction = (
  fields: Pick<Transaction, 'accountId' | 'type' | 'amount' | 'occurredAt' | 'description' | 'cdtId'> & Partial<Transaction>,
) =>
  ({
    counterAccountId: null,
    categoryId: null,
    categorySource: 'MANUAL',
    reimbursementGroupId: null,
    subscriptionId: null,
    subscriptionPeriod: null,
    recurringIncomeId: null,
    recurringIncomePeriod: null,
    ...fields,
  }) satisfies Omit<Transaction, keyof SyncFields>;

/** Transferencia de apertura de un CDT con origen "Transferencia". */
function openingTransfer(cdt: Cdt): Transaction | undefined {
  return liveTransactions().find((t) => t.cdtId === cdt.id && t.type === 'TRANSFER' && t.counterAccountId === cdt.accountId);
}

/**
 * Crea en una sola transacción la cuenta INVESTMENT, el CDT y, si hay cuenta de origen, la
 * transferencia de apertura. Sin cuenta de origen (CDT existente, spec 009) no se crea ningún
 * movimiento: la cuenta arranca con el capital como saldo inicial.
 */
export async function createCdt(input: CdtInput): Promise<Cdt> {
  const valid = prepare(input);
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
    openingBalance: (valid.sourceAccountId ? 0 : valid.principal) as Account['openingBalance'],
    creditLimit: null,
    statementDay: null,
    paymentDueDay: null,
    isExcludedFromNetWorth: false,
    isArchived: false,
    sortOrder: Math.max(0, ...Object.values(accounts).map((a) => a.sortOrder)) + 1,
  };
  const cdt: Cdt = { ...newRecordFields(), ...valid, accountId: account.id };
  const opening: Transaction | null = valid.sourceAccountId
    ? {
        ...newRecordFields(),
        ...baseTransaction({
          accountId: valid.sourceAccountId,
          type: 'TRANSFER',
          amount: valid.principal,
          occurredAt: localDateTimeToUtc(valid.openedOn, 10, 0),
          description: `Apertura CDT ${valid.issuer}`,
          cdtId: cdt.id,
        }),
        counterAccountId: account.id,
      }
    : null;
  await batch((draft) => {
    draft.accounts[account.id] = account;
    draft.cdts[cdt.id] = cdt;
    if (opening) draft.transactions[opening.id] = opening;
  });
  return cdt;
}

/**
 * Edita el periodo vigente (research R12). El origen no cambia. Si cambia el capital se ajusta su
 * contrapartida: la transferencia de apertura (transferencia) o el saldo inicial (existente). El
 * capital de una renovación no se edita aquí: se borra la renovación y se renueva de nuevo.
 */
export async function updateCdt(id: string, changes: Partial<CdtInput>): Promise<Cdt> {
  const stored = getEntity('cdts', id);
  if (liveSuccessor(stored, liveCdts())) {
    throw new ValidationError('INVALID', undefined, 'Este periodo ya fue renovado; edita el periodo vigente.');
  }
  const { id: _id, createdAt: _c, updatedAt: _u, deletedAt: _d, accountId: _a, ...current } = stored;
  const merged = prepare({ ...current, ...changes });
  const origin = cdtOrigin(stored);
  if (cdtOrigin(merged) !== origin) {
    throw new ValidationError('INVALID', 'sourceAccountId', 'El origen del dinero de un CDT no se puede cambiar.');
  }
  if (origin === 'RENEWAL' && merged.principal !== stored.principal) {
    throw new ValidationError('INVALID', 'principal', 'Para cambiar el capital de una renovación, bórrala y renueva de nuevo.');
  }
  const updated: Cdt = { ...stored, ...merged, updatedAt: nowUtc() };
  const opening = origin === 'TRANSFER' ? openingTransfer(stored) : undefined;
  await batch((draft) => {
    draft.cdts[id] = updated;
    if (opening) {
      draft.transactions[opening.id] = {
        ...opening,
        accountId: merged.sourceAccountId!,
        amount: merged.principal,
        occurredAt: merged.openedOn === stored.openedOn ? opening.occurredAt : localDateTimeToUtc(merged.openedOn, 10, 0),
        description: `Apertura CDT ${merged.issuer}`,
      };
    }
    if (origin === 'EXISTING' && merged.principal !== stored.principal) {
      const account = draft.accounts[stored.accountId];
      if (account) draft.accounts[account.id] = { ...account, openingBalance: merged.principal };
    }
  });
  return updated;
}

export interface CdtDeletionPreview {
  allowed: boolean;
  reason?: string;
  /** Movimientos que se borrarán junto con el CDT. */
  transactionCount: number;
}

interface DeletionPlan {
  cdtIds: string[];
  accountId: string | null;
  transactionIds: string[];
  restorePreviousId: string | null;
}

function deletionPlan(id: string): DeletionPlan | { reason: string } {
  const cdt = getEntity('cdts', id);
  if (liveSuccessor(cdt, liveCdts())) return { reason: 'Primero borra la renovación más reciente.' };
  const transactions = liveTransactions();
  if (cdt.renewedFromCdtId) {
    const previousId = cdt.renewedFromCdtId;
    const ids = transactions.filter((t) => t.cdtId === id || (t.cdtId === previousId && t.type === 'INCOME')).map((t) => t.id);
    return { cdtIds: [id], accountId: null, transactionIds: ids, restorePreviousId: previousId };
  }
  const ids = transactions
    .filter((t) => t.cdtId === id || t.accountId === cdt.accountId || t.counterAccountId === cdt.accountId)
    .map((t) => t.id);
  const shared = liveCdts().some((c) => c.id !== id && c.accountId === cdt.accountId);
  return { cdtIds: [id], accountId: shared ? null : cdt.accountId, transactionIds: ids, restorePreviousId: null };
}

/** Lo que borraría `deleteCdt` (para el diálogo de confirmación, FR-014). */
export function cdtDeletionPreview(id: string): CdtDeletionPreview {
  const plan = deletionPlan(id);
  if ('reason' in plan) return { allowed: false, reason: plan.reason, transactionCount: 0 };
  return { allowed: true, transactionCount: plan.transactionIds.length };
}

/**
 * Borrado lógico en cascada (FR-015/016, research R8). Raíz: CDT, cuenta INVESTMENT y todos los
 * movimientos de la cuenta. Renovación: se deshace (el anterior vuelve a ACTIVE sin liquidación).
 */
export async function deleteCdt(id: string): Promise<void> {
  const plan = deletionPlan(id);
  if ('reason' in plan) throw new ValidationError('INVALID', undefined, plan.reason);
  const at = nowUtc();
  const remove = <T extends SyncFields>(record: T | undefined): T | undefined => record && { ...record, deletedAt: at, updatedAt: at };
  await batch((draft: FinanceData) => {
    for (const cdtId of plan.cdtIds) draft.cdts[cdtId] = remove(draft.cdts[cdtId])!;
    for (const txId of plan.transactionIds) draft.transactions[txId] = remove(draft.transactions[txId])!;
    if (plan.accountId) draft.accounts[plan.accountId] = remove(draft.accounts[plan.accountId])!;
    if (plan.restorePreviousId) {
      const previous = draft.cdts[plan.restorePreviousId];
      if (previous) {
        draft.cdts[previous.id] = {
          ...previous,
          status: 'ACTIVE',
          settledGrossInterest: null,
          settledWithholding: null,
          settledNetInterest: null,
          updatedAt: at,
        };
      }
    }
  });
}

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Categoría de ingreso para el interés: "Rendimientos"/"Intereses" si existe; si no, sin categoría. */
function interestCategoryId(): string | null {
  const category = Object.values(useFinanceStore.getState().categories)
    .filter((c) => !c.deletedAt && c.kind === 'INCOME')
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .find((c) => /interes|rendimiento/.test(normalize(c.name)));
  return category?.id ?? null;
}

/** Registro con ID determinista: si existía (p. ej. borrado al deshacer), se sobrescribe vivo. */
function withFixedId<T extends SyncFields>(id: string, existing: T | undefined, at: string): SyncFields {
  return { id, createdAt: existing?.createdAt ?? at, updatedAt: at, deletedAt: null };
}

/**
 * Renueva un CDT vencido (FR-017–FR-021, research R4/R6) en una sola operación: ingreso por el
 * interés neto del periodo que termina, liquidación del anterior (bruto/retención/neto), nuevo
 * periodo en la misma cuenta y, si aplica, la transferencia de aporte o retiro y el ajuste por la
 * diferencia entre el capital del banco y valor final ± aporte/retiro. Los movimientos y el valor
 * esperado del periodo anterior no se modifican.
 */
export async function renewCdt(id: string, input: CdtRenewalInput, today: IsoDate = todayLocal()): Promise<Cdt> {
  const previous = getEntity('cdts', id);
  if (previous.deletedAt) throw new ValidationError('NOT_FOUND', undefined, 'El CDT no existe.');
  if (previous.status !== 'ACTIVE' || liveSuccessor(previous, liveCdts())) {
    throw new ValidationError('INVALID', undefined, 'Este CDT ya fue renovado.');
  }
  if (!canRenew(previous, liveCdts(), today)) {
    const date = formatDateLocal(previous.maturesOn, "d 'de' MMMM 'de' yyyy");
    throw new ValidationError('INVALID', 'openedOn', `Podrás renovar desde el ${date}.`);
  }
  const { operation } = input;
  const amount = operation === 'RENEW' ? null : input.amount;
  const value = input.previousMaturityValue;
  if (value < previous.principal) {
    throw new ValidationError('INVALID', 'previousMaturityValue', 'El valor final no puede ser menor que el capital.');
  }
  if (operation !== 'RENEW') {
    if (!amount || amount <= 0) throw new ValidationError('INVALID', 'amount', 'El monto debe ser mayor que cero.');
    if (operation === 'WITHDRAW' && amount >= value) {
      throw new ValidationError('INVALID', 'amount', 'El nuevo capital debe ser mayor que cero.');
    }
    if (!input.adjustmentAccountId) throw new ValidationError('INVALID', 'adjustmentAccountId', 'Elige la cuenta.');
    checkAssetAccount('adjustmentAccountId', input.adjustmentAccountId);
  }
  // Si el capital que reporta el banco difiere de valor final ± ajuste, la diferencia se registra
  // como un movimiento propio: el cierre del periodo anterior no se modifica.
  const difference = input.principal - renewalPrincipal(value, operation, amount);

  const ids = renewalIds(previous.id);
  const state = useFinanceStore.getState();
  const at = nowUtc();
  const next = prepare({
    issuer: previous.issuer,
    certificateNumber: input.certificateNumber,
    principal: input.principal,
    annualRateEa: input.annualRateEa,
    annualRateNominal: previous.annualRateNominal,
    termDays: input.termDays,
    openedOn: input.openedOn,
    maturesOn: input.maturesOn,
    interestPayment: input.interestPayment,
    withholdingRate: input.withholdingRate,
    sourceAccountId: null,
    payoutAccountId: input.payoutAccountId,
    status: 'ACTIVE',
    renewedFromCdtId: previous.id,
    maturityValueOverride: input.maturityValueOverride,
    settledGrossInterest: null,
    settledWithholding: null,
    settledNetInterest: null,
  });
  const renewal: Cdt = { ...withFixedId(ids.cdtId, state.cdts[ids.cdtId], at), ...next, accountId: previous.accountId };
  const settled = settlement(previous, value);
  // El valor esperado del periodo anterior se conserva; el valor real del cierre queda en settled*.
  const closed: Cdt = {
    ...previous,
    status: 'RENEWED',
    settledGrossInterest: settled.gross,
    settledWithholding: settled.withholding,
    settledNetInterest: settled.net,
    updatedAt: at,
  };
  const interest: Transaction | null =
    settled.net > 0
      ? {
          ...withFixedId(ids.interestId, state.transactions[ids.interestId], at),
          ...baseTransaction({
            accountId: previous.accountId,
            type: 'INCOME',
            amount: settled.net,
            occurredAt: localDateTimeToUtc(previous.maturesOn, 10, 0),
            description: `Intereses CDT ${previous.issuer}`,
            cdtId: previous.id,
          }),
          categoryId: interestCategoryId(),
        }
      : null;
  const adjustment: Transaction | null =
    operation === 'RENEW'
      ? null
      : {
          ...withFixedId(ids.adjustmentId, state.transactions[ids.adjustmentId], at),
          ...baseTransaction({
            accountId: operation === 'ADD' ? input.adjustmentAccountId! : previous.accountId,
            type: 'TRANSFER',
            amount: amount as Cents,
            occurredAt: localDateTimeToUtc(input.openedOn, 10, 0),
            description: operation === 'ADD' ? `Aporte CDT ${previous.issuer}` : `Retiro CDT ${previous.issuer}`,
            cdtId: renewal.id,
          }),
          counterAccountId: operation === 'ADD' ? previous.accountId : input.adjustmentAccountId!,
        };
  const differenceTx: Transaction | null =
    difference === 0
      ? null
      : {
          ...withFixedId(ids.differenceId, state.transactions[ids.differenceId], at),
          ...baseTransaction({
            accountId: previous.accountId,
            type: difference > 0 ? 'INCOME' : 'EXPENSE',
            amount: Math.abs(difference) as Cents,
            occurredAt: localDateTimeToUtc(input.openedOn, 10, 0),
            description: `Ajuste renovación CDT ${previous.issuer}`,
            cdtId: renewal.id,
          }),
        };
  await batch((draft) => {
    draft.cdts[closed.id] = closed;
    draft.cdts[renewal.id] = renewal;
    if (interest) draft.transactions[interest.id] = interest;
    if (adjustment) draft.transactions[adjustment.id] = adjustment;
    // Con ID determinista: si una renovación previa (deshecha) tuvo diferencia y esta no, queda borrada.
    const staleDifference = draft.transactions[ids.differenceId];
    if (differenceTx) draft.transactions[differenceTx.id] = differenceTx;
    else if (staleDifference && !staleDifference.deletedAt) {
      draft.transactions[ids.differenceId] = { ...staleDifference, deletedAt: at, updatedAt: at };
    }
  });
  return renewal;
}
