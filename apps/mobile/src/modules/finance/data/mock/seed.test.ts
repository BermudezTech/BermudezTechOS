import { addDays, daysBetween } from '@/lib/dates';

import { balancesByAccount } from '../../domain/balances';
import { buildSeed } from './seed';

const TODAY = '2026-10-17';

describe('buildSeed("full")', () => {
  const data = buildSeed('full', TODAY);
  const accounts = Object.values(data.accounts);
  const txs = Object.values(data.transactions);
  const countType = (type: string) => accounts.filter((a) => a.type === type).length;

  it('incluye todos los tipos de cuenta requeridos', () => {
    expect(countType('CHECKING')).toBe(1);
    expect(countType('SAVINGS')).toBeGreaterThanOrEqual(2);
    expect(countType('POCKET')).toBe(2);
    expect(countType('CASH')).toBe(1);
    expect(countType('CREDIT_CARD')).toBe(2);
    expect(countType('INVESTMENT')).toBeGreaterThanOrEqual(2);
    expect(accounts.filter((a) => a.isExcludedFromNetWorth)).toHaveLength(1);
    expect(accounts.filter((a) => a.isArchived)).toHaveLength(1);
  });

  it('respeta las reglas de cuentas', () => {
    for (const a of accounts) {
      expect(a.type === 'POCKET').toBe(a.parentAccountId !== null);
      expect(a.nature).toBe(a.type === 'CREDIT_CARD' ? 'LIABILITY' : 'ASSET');
      if (a.type === 'CREDIT_CARD') expect(a.creditLimit).toBeGreaterThan(0);
    }
  });

  it('tiene al menos 13 meses y ~300 movimientos válidos', () => {
    expect(txs.length).toBeGreaterThanOrEqual(300);
    const oldest = txs.reduce((min, t) => (t.occurredAt < min ? t.occurredAt : min), txs[0]!.occurredAt);
    expect(daysBetween(oldest.slice(0, 10), TODAY)).toBeGreaterThanOrEqual(365);
    for (const t of txs) {
      expect(Number.isSafeInteger(t.amount) && t.amount > 0).toBe(true);
      expect(t.type === 'TRANSFER').toBe(t.counterAccountId !== null);
      if (t.counterAccountId) expect(t.counterAccountId).not.toBe(t.accountId);
      if (t.type === 'TRANSFER') expect(t.categoryId).toBeNull();
      expect(data.accounts[t.accountId]).toBeDefined();
    }
  });

  it('incluye categorías de IA, sin categoría y pagos de tarjeta', () => {
    expect(txs.filter((t) => t.categorySource === 'AI').length).toBeGreaterThanOrEqual(3);
    expect(txs.filter((t) => t.type === 'EXPENSE' && t.categoryId === null && !t.reimbursementGroupId).length).toBeGreaterThanOrEqual(2);
    const cards = new Set(accounts.filter((a) => a.type === 'CREDIT_CARD').map((a) => a.id));
    expect(txs.some((t) => t.type === 'TRANSFER' && cards.has(t.counterAccountId ?? ''))).toBe(true);
    expect(Object.keys(data.categories)).toHaveLength(13);
  });

  it('incluye CDTs, suscripciones, grupos y bienes requeridos', () => {
    const cdts = Object.values(data.cdts);
    expect(cdts.filter((c) => c.status === 'ACTIVE')).toHaveLength(2);
    expect(cdts.filter((c) => c.status === 'MATURED')).toHaveLength(1);
    expect(cdts.some((c) => c.status === 'ACTIVE' && daysBetween(TODAY, c.maturesOn) <= 15 && c.maturesOn >= TODAY)).toBe(true);

    const subs = Object.values(data.subscriptions);
    expect(subs.filter((s) => s.billingCycle === 'MONTHLY')).toHaveLength(3);
    expect(subs.filter((s) => s.billingCycle === 'YEARLY')).toHaveLength(1);
    expect(subs.some((s) => s.status === 'PAUSED')).toBe(true);
    expect(subs.some((s) => s.billingDay === 31)).toBe(true);

    const groups = Object.values(data.reimbursementGroups);
    expect(groups.map((g) => `${g.kind}:${g.status}`).sort()).toEqual(['ADVANCE:OPEN', 'REIMBURSEMENT:OPEN', 'REIMBURSEMENT:SETTLED']);

    const assets = Object.values(data.assets);
    expect(assets).toHaveLength(2);
    expect(assets.some((a) => a.validUntil < TODAY)).toBe(true);
  });

  it('ninguna fecha es futura y las cuentas de activo no quedan negativas', () => {
    const end = addDays(TODAY, 1);
    expect(txs.every((t) => t.occurredAt < `${end}T05:00:00.000Z`)).toBe(true);
    const balances = balancesByAccount(accounts, txs);
    for (const a of accounts) if (a.nature === 'ASSET') expect(balances.get(a.id)).toBeGreaterThanOrEqual(0);
  });

  it('es determinista', () => {
    expect(buildSeed('full', TODAY)).toEqual(data);
  });
});

describe('buildSeed("empty")', () => {
  it('solo contiene las categorías iniciales', () => {
    const data = buildSeed('empty', TODAY);
    expect(Object.keys(data.categories)).toHaveLength(13);
    expect(Object.keys(data.accounts)).toHaveLength(0);
    expect(Object.keys(data.transactions)).toHaveLength(0);
  });
});
