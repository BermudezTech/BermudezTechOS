import { Decimal } from 'decimal.js';

import { addDays, daysBetween, type IsoDate } from '@/lib/dates';
import { sum, toDecimal, type Cents } from '@/lib/money';

import { accruedInterest, currentValue, elapsedDays, expectedNetAtMaturity, totalInterest, withholdingAmount } from './cdtValuation';
import type { Cdt, Transaction } from './types';

export const MATURING_SOON_DAYS = 15;

export interface CdtSummary {
  totalInvested: Cents;
  /** Rendimiento promedio ponderado E.A. en % (Decimal). */
  weightedRate: Decimal;
  activeCount: number;
}

export interface CdtValues {
  cdt: Cdt;
  accrued: Cents;
  currentValue: Cents;
  totalInterest: Cents;
  withholding: Cents;
  expectedNet: Cents;
  daysElapsed: number;
  daysRemaining: number;
  maturingSoon: boolean;
}

export function defaultMaturesOn(openedOn: IsoDate, termDays: number): IsoDate {
  return addDays(openedOn, termDays);
}

/** ACTIVO y vence en ≤ 15 días (FR-025). */
export function isMaturingSoon(cdt: Pick<Cdt, 'status' | 'maturesOn'>, today: IsoDate): boolean {
  if (cdt.status !== 'ACTIVE') return false;
  const days = daysBetween(today, cdt.maturesOn);
  return days >= 0 && days <= MATURING_SOON_DAYS;
}

/** Rendimiento promedio ponderado = Σ(principal × EA) / Σ principal sobre CDTs ACTIVE. */
export function cdtSummary(cdts: Cdt[]): CdtSummary {
  const active = cdts.filter((c) => !c.deletedAt && c.status === 'ACTIVE');
  const totalInvested = sum(active.map((c) => c.principal));
  const weighted = active.reduce((acc, c) => acc.plus(toDecimal(c.principal).mul(c.annualRateEa)), new Decimal(0));
  return {
    totalInvested,
    weightedRate: totalInvested === 0 ? new Decimal(0) : weighted.div(totalInvested),
    activeCount: active.length,
  };
}

const statusOrder: Record<Cdt['status'], number> = { ACTIVE: 0, MATURED: 1, RENEWED: 2, CANCELLED: 3 };

/** Activos primero, ordenados por fecha de vencimiento. */
export function sortByMaturity(cdts: Cdt[]): Cdt[] {
  return [...cdts].sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || a.maturesOn.localeCompare(b.maturesOn));
}

export function cdtValues(cdt: Cdt, transactions: Transaction[], today: IsoDate): CdtValues {
  const paid = sum(transactions.filter((t) => t.cdtId === cdt.id && t.type === 'INCOME' && !t.deletedAt).map((t) => t.amount));
  return {
    cdt,
    accrued: accruedInterest(cdt, today),
    currentValue: cdt.status === 'ACTIVE' ? currentValue(cdt, paid, today) : (0 as Cents),
    totalInterest: totalInterest(cdt),
    withholding: withholdingAmount(cdt),
    expectedNet: expectedNetAtMaturity(cdt),
    daysElapsed: elapsedDays(cdt, today),
    daysRemaining: Math.max(0, daysBetween(today, cdt.maturesOn)),
    maturingSoon: isMaturingSoon(cdt, today),
  };
}
