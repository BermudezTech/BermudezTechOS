import type { SqlDatabase } from '@/db/types';
import { cents, type Cents } from '@/lib/money';

import { balancesByAccount } from '../../domain/balances';
import { createAccount } from './accountsRepo';
import { CDT_ID_NAMESPACE, uuidV5 } from '@/lib/ids';
import { localDateTimeToUtc } from '@/lib/dates';

import { calculatedMaturityValue, settlement } from '../../domain/cdtValuation';
import { makeCategory } from '../../domain/testUtils';
import type { CdtInput, CdtRenewalInput } from '../../domain/types';
import { ValidationError } from '../FinanceRepository';
import { cdtDeletionPreview, createCdt, deleteCdt, renewCdt, updateCdt } from './cdtsRepo';
import { useFinanceStore } from './store';
import { accountInput, putCategory, setupLocalDb } from './testing';

let db: SqlDatabase;

beforeEach(async () => {
  db = await setupLocalDb();
});

const cdtInput = (over: Partial<CdtInput> = {}): CdtInput => ({
  issuer: 'Banco',
  certificateNumber: null,
  principal: cents(10_000_000_00),
  annualRateEa: '10.0000',
  annualRateNominal: '9.7618',
  termDays: 180,
  openedOn: '2026-01-15',
  maturesOn: '2026-07-15',
  interestPayment: 'AT_MATURITY',
  withholdingRate: '4.00',
  sourceAccountId: null,
  payoutAccountId: null,
  status: 'ACTIVE',
  renewedFromCdtId: null,
  maturityValueOverride: null,
  settledGrossInterest: null,
  settledWithholding: null,
  settledNetInterest: null,
  ...over,
});

const state = () => useFinanceStore.getState();
const balances = () => balancesByAccount(Object.values(state().accounts), Object.values(state().transactions));
const balanceOf = (id: string): Cents | undefined => balances().get(id);
const liveTransactions = () => Object.values(state().transactions).filter((t) => !t.deletedAt);

describe('createCdt (spec 009, US2)', () => {
  it('CDT existente: cuenta con saldo inicial = capital y sin movimientos', async () => {
    const savings = await createAccount(accountInput({ openingBalance: cents(5_000_000_00) }));
    const before = balanceOf(savings.id);

    const cdt = await createCdt(cdtInput({ sourceAccountId: null, openedOn: '2025-06-01', maturesOn: '2025-09-01', termDays: 90 }));

    const account = state().accounts[cdt.accountId]!;
    expect(account.type).toBe('INVESTMENT');
    expect(account.openingBalance).toBe(cdt.principal);
    expect(liveTransactions()).toHaveLength(0);
    expect(balanceOf(cdt.accountId)).toBe(cdt.principal);
    expect(balanceOf(savings.id)).toBe(before);
  });

  it('CDT por transferencia: transferencia de apertura por el capital y saldo inicial 0', async () => {
    const savings = await createAccount(accountInput({ openingBalance: cents(20_000_000_00) }));

    const cdt = await createCdt(cdtInput({ sourceAccountId: savings.id }));

    expect(state().accounts[cdt.accountId]!.openingBalance).toBe(0);
    const [opening] = liveTransactions();
    expect(opening).toMatchObject({
      type: 'TRANSFER',
      accountId: savings.id,
      counterAccountId: cdt.accountId,
      amount: cdt.principal,
      cdtId: cdt.id,
    });
    expect(balanceOf(savings.id)).toBe(cents(10_000_000_00));
    expect(balanceOf(cdt.accountId)).toBe(cdt.principal);
  });

  it('se persiste en SQLite con source_account_id NULL', async () => {
    const cdt = await createCdt(cdtInput());
    const row = await db.getFirstAsync<{ source_account_id: string | null }>('SELECT source_account_id FROM cdts WHERE id = ?', [cdt.id]);
    expect(row).toEqual({ source_account_id: null });
  });
});

describe('createCdt / updateCdt: tasa nominal derivada y edición (US3)', () => {
  it('ignora la nominal recibida y la deriva de la TEA o del valor ajustado', async () => {
    const cdt = await createCdt(cdtInput({ annualRateNominal: '1.0000' }));
    expect(cdt.annualRateNominal).toBe('9.7618');
    const adjusted = await updateCdt(cdt.id, { maturityValueOverride: cents(10_470_000_00) });
    expect(adjusted.annualRateNominal).toBe('9.7917');
    expect(adjusted.maturityValueOverride).toBe(10_470_000_00);
  });

  it('rechaza un valor final menor que el capital', async () => {
    await expect(createCdt(cdtInput({ maturityValueOverride: cents(9_000_000_00) }))).rejects.toThrow(
      'El valor final no puede ser menor que el capital.',
    );
  });

  it('al cambiar el capital ajusta la transferencia de apertura o el saldo inicial', async () => {
    const savings = await createAccount(accountInput({ openingBalance: cents(20_000_000_00) }));
    const byTransfer = await createCdt(cdtInput({ sourceAccountId: savings.id }));
    await updateCdt(byTransfer.id, { principal: cents(12_000_000_00) });
    expect(balanceOf(savings.id)).toBe(cents(8_000_000_00));
    expect(balanceOf(byTransfer.accountId)).toBe(cents(12_000_000_00));

    const existing = await createCdt(cdtInput());
    await updateCdt(existing.id, { principal: cents(3_000_000_00) });
    expect(balanceOf(existing.accountId)).toBe(cents(3_000_000_00));
  });

  it('no permite cambiar el origen', async () => {
    const savings = await createAccount(accountInput());
    const existing = await createCdt(cdtInput());
    await expect(updateCdt(existing.id, { sourceAccountId: savings.id })).rejects.toThrow('El origen del dinero');
  });
});

const TODAY = '2026-11-01';

/** CDT existente vencido el 2026-07-15 (abierto 2026-01-15 a 180 días). */
async function maturedCdt(over: Partial<CdtInput> = {}) {
  return createCdt(cdtInput(over));
}

function renewal(
  previous: { principal: Cents; maturesOn: string } & Parameters<typeof calculatedMaturityValue>[0],
  over: Partial<CdtRenewalInput> = {},
): CdtRenewalInput {
  const value = over.previousMaturityValue ?? calculatedMaturityValue(previous);
  const operation = over.operation ?? 'RENEW';
  const amount = over.amount ?? null;
  const principal = (operation === 'ADD' ? value + (amount ?? 0) : operation === 'WITHDRAW' ? value - (amount ?? 0) : value) as Cents;
  return {
    previousMaturityValue: value,
    operation,
    amount,
    adjustmentAccountId: null,
    principal,
    annualRateEa: '9.5000',
    termDays: 90,
    withholdingRate: '4.00',
    openedOn: previous.maturesOn,
    maturesOn: '2026-10-15',
    maturityValueOverride: null,
    interestPayment: 'AT_MATURITY',
    payoutAccountId: null,
    certificateNumber: null,
    ...over,
  };
}

describe('renewCdt (US5)', () => {
  it('solo renovar: interés neto, liquidación, nuevo periodo en la misma cuenta y sin cuentas', async () => {
    putCategory(makeCategory({ id: 'rend', name: 'Rendimientos', kind: 'INCOME' }));
    const previous = await maturedCdt();
    const value = calculatedMaturityValue(previous);

    const next = await renewCdt(previous.id, renewal(previous), TODAY);

    expect(next.id).toBe(uuidV5(CDT_ID_NAMESPACE, `${previous.id}:renewal`));
    expect(next).toMatchObject({
      accountId: previous.accountId,
      sourceAccountId: null,
      renewedFromCdtId: previous.id,
      status: 'ACTIVE',
      principal: value,
    });
    const closed = state().cdts[previous.id]!;
    const expected = settlement(previous, value);
    expect(closed).toMatchObject({
      status: 'RENEWED',
      settledGrossInterest: expected.gross,
      settledWithholding: expected.withholding,
      settledNetInterest: expected.net,
    });
    const interest = state().transactions[uuidV5(CDT_ID_NAMESPACE, `${previous.id}:interest`)]!;
    expect(interest).toMatchObject({
      type: 'INCOME',
      accountId: previous.accountId,
      amount: value - previous.principal,
      cdtId: previous.id,
      categoryId: 'rend',
      occurredAt: localDateTimeToUtc('2026-07-15', 10, 0),
    });
    expect(balanceOf(previous.accountId)).toBe(next.principal);
  });

  it('agregar capital: transferencia desde la cuenta de origen', async () => {
    const savings = await createAccount(accountInput({ openingBalance: cents(5_000_000_00) }));
    const previous = await maturedCdt();
    const next = await renewCdt(
      previous.id,
      renewal(previous, { operation: 'ADD', amount: cents(1_000_000_00), adjustmentAccountId: savings.id }),
      TODAY,
    );

    const adjustment = state().transactions[uuidV5(CDT_ID_NAMESPACE, `${next.id}:adjustment`)]!;
    expect(adjustment).toMatchObject({
      type: 'TRANSFER',
      accountId: savings.id,
      counterAccountId: previous.accountId,
      amount: 1_000_000_00,
      cdtId: next.id,
    });
    expect(next.principal).toBe(calculatedMaturityValue(previous) + 1_000_000_00);
    expect(balanceOf(savings.id)).toBe(cents(4_000_000_00));
    expect(balanceOf(previous.accountId)).toBe(next.principal);
  });

  it('retirar capital: transferencia hacia la cuenta destino', async () => {
    const savings = await createAccount(accountInput());
    const previous = await maturedCdt();
    const next = await renewCdt(
      previous.id,
      renewal(previous, { operation: 'WITHDRAW', amount: cents(2_000_000_00), adjustmentAccountId: savings.id }),
      TODAY,
    );
    expect(next.principal).toBe(calculatedMaturityValue(previous) - 2_000_000_00);
    expect(balanceOf(savings.id)).toBe(cents(2_000_000_00));
    expect(balanceOf(previous.accountId)).toBe(next.principal);
  });

  it('con valor final ajustado al banco: la liquidación cuadra y el valor esperado del anterior no cambia', async () => {
    const previous = await maturedCdt();
    const bank = cents(10_470_000_00);
    await renewCdt(previous.id, renewal(previous, { previousMaturityValue: bank }), TODAY);
    const closed = state().cdts[previous.id]!;
    expect(closed.maturityValueOverride).toBe(previous.maturityValueOverride);
    expect(closed.settledGrossInterest! - closed.settledWithholding!).toBe(closed.settledNetInterest);
    expect(closed.settledNetInterest).toBe(bank - previous.principal);
  });

  it('capital del banco distinto: registra la diferencia como ajuste y no toca nada del periodo anterior', async () => {
    const savings = await createAccount(accountInput({ openingBalance: cents(20_000_000_00) }));
    const previous = await createCdt(cdtInput({ sourceAccountId: savings.id }));
    const openingBefore = { ...liveTransactions()[0]! };
    const value = calculatedMaturityValue(previous);
    const bankPrincipal = (value + 1_234_56) as Cents;

    const next = await renewCdt(previous.id, renewal(previous, { principal: bankPrincipal }), TODAY);

    expect(next.principal).toBe(bankPrincipal);
    const difference = state().transactions[uuidV5(CDT_ID_NAMESPACE, `${next.id}:difference`)]!;
    expect(difference).toMatchObject({ type: 'INCOME', accountId: previous.accountId, amount: 1_234_56, cdtId: next.id });
    // El cierre del anterior refleja el valor final indicado, no el capital nuevo.
    expect(state().cdts[previous.id]!.settledNetInterest).toBe(value - previous.principal);
    expect(state().cdts[previous.id]!.maturityValueOverride).toBeNull();
    // La transferencia de apertura queda intacta.
    expect(state().transactions[openingBefore.id]).toEqual(openingBefore);
    expect(balanceOf(previous.accountId)).toBe(bankPrincipal);

    // Capital menor: la diferencia es un egreso. Al deshacer y renovar sin diferencia, el ajuste se borra.
    await deleteCdt(next.id);
    expect(state().transactions[difference.id]!.deletedAt).not.toBeNull();
    await renewCdt(previous.id, renewal(previous, { principal: (value - 50_00) as Cents }), TODAY);
    expect(state().transactions[difference.id]).toMatchObject({ type: 'EXPENSE', amount: 50_00, deletedAt: null });
    await deleteCdt(next.id);
    await renewCdt(previous.id, renewal(previous), TODAY);
    expect(state().transactions[difference.id]!.deletedAt).not.toBeNull();
    expect(balanceOf(previous.accountId)).toBe(value);
  });

  it('rechaza renovar antes del vencimiento, dos veces, retiros ≥ valor final y valor < capital', async () => {
    const savings = await createAccount(accountInput());
    const notYet = await maturedCdt({ openedOn: '2026-10-01', maturesOn: '2027-03-31' });
    await expect(renewCdt(notYet.id, renewal(notYet), TODAY)).rejects.toThrow('Podrás renovar desde el');
    // El mismo día del vencimiento sí se puede (inclusive).
    await expect(renewCdt(notYet.id, renewal(notYet, { maturesOn: '2027-06-30' }), '2027-03-31')).resolves.toBeDefined();

    const previous = await maturedCdt();
    const value = calculatedMaturityValue(previous);
    await expect(
      renewCdt(previous.id, renewal(previous, { operation: 'WITHDRAW', amount: value, adjustmentAccountId: savings.id }), TODAY),
    ).rejects.toThrow('El nuevo capital debe ser mayor que cero.');
    await expect(renewCdt(previous.id, renewal(previous, { previousMaturityValue: cents(1_00) }), TODAY)).rejects.toThrow(
      'El valor final no puede ser menor que el capital.',
    );
    await renewCdt(previous.id, renewal(previous), TODAY);
    await expect(renewCdt(previous.id, renewal(previous), TODAY)).rejects.toThrow('Este CDT ya fue renovado.');
  });

  it('es atómica: si falla la escritura no queda nada', async () => {
    const previous = await maturedCdt();
    const before = JSON.stringify(state());
    const original = db.runAsync.bind(db);
    let calls = 0;
    db.runAsync = async (sql, params) => {
      if (/^(INSERT|UPDATE)/.test(sql) && ++calls === 2) throw new Error('disco lleno');
      return original(sql, params);
    };
    await expect(renewCdt(previous.id, renewal(previous), TODAY)).rejects.toThrow('disco lleno');
    db.runAsync = original;
    expect(JSON.stringify(state())).toBe(before);
    expect((await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM cdts'))!.n).toBe(1);
  });
});

describe('deleteCdt (US4)', () => {
  it('raíz por transferencia: borra CDT, cuenta y movimientos; los saldos vuelven exactos', async () => {
    const savings = await createAccount(accountInput({ openingBalance: cents(20_000_000_00) }));
    const before = balances();
    const cdt = await createCdt(cdtInput({ sourceAccountId: savings.id }));
    expect(cdtDeletionPreview(cdt.id)).toEqual({ allowed: true, transactionCount: 1 });

    await deleteCdt(cdt.id);

    expect(state().cdts[cdt.id]!.deletedAt).not.toBeNull();
    expect(state().accounts[cdt.accountId]!.deletedAt).not.toBeNull();
    expect(liveTransactions()).toHaveLength(0);
    expect(balances()).toEqual(before);
    const row = await db.getFirstAsync<{ deleted_at: string | null; is_dirty: number }>(
      'SELECT deleted_at, is_dirty FROM cdts WHERE id = ?',
      [cdt.id],
    );
    expect(row?.deleted_at).not.toBeNull();
    expect(row?.is_dirty).toBe(1);
  });

  it('raíz existente: borra CDT y cuenta', async () => {
    const cdt = await createCdt(cdtInput());
    await deleteCdt(cdt.id);
    expect(state().accounts[cdt.accountId]!.deletedAt).not.toBeNull();
  });

  it('no borra un periodo con renovación viva', async () => {
    const previous = await maturedCdt();
    await renewCdt(previous.id, renewal(previous), TODAY);
    expect(cdtDeletionPreview(previous.id)).toEqual({
      allowed: false,
      reason: 'Primero borra la renovación más reciente.',
      transactionCount: 0,
    });
    await expect(deleteCdt(previous.id)).rejects.toBeInstanceOf(ValidationError);
  });

  it('borrar una renovación la deshace y se puede renovar de nuevo con los mismos IDs', async () => {
    const savings = await createAccount(accountInput({ openingBalance: cents(5_000_000_00) }));
    const previous = await maturedCdt();
    const next = await renewCdt(
      previous.id,
      renewal(previous, { operation: 'ADD', amount: cents(1_000_000_00), adjustmentAccountId: savings.id }),
      TODAY,
    );
    expect(cdtDeletionPreview(next.id)).toEqual({ allowed: true, transactionCount: 2 });

    await deleteCdt(next.id);

    expect(state().cdts[next.id]!.deletedAt).not.toBeNull();
    expect(state().cdts[previous.id]).toMatchObject({
      status: 'ACTIVE',
      settledGrossInterest: null,
      settledWithholding: null,
      settledNetInterest: null,
      deletedAt: null,
    });
    expect(state().accounts[previous.accountId]!.deletedAt).toBeNull();
    expect(liveTransactions()).toHaveLength(0);
    expect(balanceOf(savings.id)).toBe(cents(5_000_000_00));
    expect(balanceOf(previous.accountId)).toBe(previous.principal);

    const again = await renewCdt(previous.id, renewal(previous), TODAY);
    expect(again.id).toBe(next.id);
    expect(again.deletedAt).toBeNull();
    expect(liveTransactions()).toHaveLength(1);
  });
});
