import { Decimal } from 'decimal.js';

import { addCommercialDays, daysBetween, type IsoDate } from '@/lib/dates';
import { sum, toDecimal, type Cents } from '@/lib/money';

import { maturityValue, settlement, type Settlement } from './cdtValuation';
import type { Cdt, CdtOrigin, RenewalOperation } from './types';

export const MATURING_SOON_DAYS = 15;

export interface CdtSummary {
  totalInvested: Cents;
  /** Rendimiento promedio ponderado E.A. en % (Decimal). */
  weightedRate: Decimal;
  activeCount: number;
}

export interface CdtValues {
  cdt: Cdt;
  /** Valor neto al vencimiento: el liquidado si se renovó; si no, el esperado (banco o calculado). */
  maturityValue: Cents;
  isOverridden: boolean;
  /** Bruto, retención y neto: los guardados al renovar, o los esperados del periodo vigente. */
  settlement: Settlement;
  daysElapsed: number;
  daysRemaining: number;
  maturingSoon: boolean;
  canRenew: boolean;
  /** Periodos de la cadena de renovaciones, del más antiguo al actual (incluido). */
  chain: Cdt[];
}

/** Origen del dinero del periodo (research R5). */
export function cdtOrigin(cdt: Pick<Cdt, 'renewedFromCdtId' | 'sourceAccountId'>): CdtOrigin {
  if (cdt.renewedFromCdtId) return 'RENEWAL';
  return cdt.sourceAccountId ? 'TRANSFER' : 'EXISTING';
}

/** Vencimiento propuesto con días comerciales (spec 009, FR-001). */
export function defaultMaturesOn(openedOn: IsoDate, termDays: number): IsoDate {
  return addCommercialDays(openedOn, termDays);
}

/** ACTIVO y vence en ≤ 15 días (FR-025). */
export function isMaturingSoon(cdt: Pick<Cdt, 'status' | 'maturesOn'>, today: IsoDate): boolean {
  if (cdt.status !== 'ACTIVE') return false;
  const days = daysBetween(today, cdt.maturesOn);
  return days >= 0 && days <= MATURING_SOON_DAYS;
}

/** Periodo vivo que renovó a `cdt`, si existe. */
export function liveSuccessor(cdt: Pick<Cdt, 'id'>, cdts: Iterable<Cdt>): Cdt | null {
  for (const other of cdts) {
    if (!other.deletedAt && other.renewedFromCdtId === cdt.id) return other;
  }
  return null;
}

/** Se puede renovar desde el día del vencimiento, inclusive (FR-017, research R10). */
export function canRenew(cdt: Cdt, cdts: Iterable<Cdt>, today: IsoDate): boolean {
  return cdt.status === 'ACTIVE' && !cdt.deletedAt && today >= cdt.maturesOn && liveSuccessor(cdt, cdts) === null;
}

/** Cadena de renovaciones hasta `cdt`, del periodo más antiguo al actual. */
export function cdtChain(cdt: Cdt, byId: Record<string, Cdt>): Cdt[] {
  const chain = [cdt];
  const seen = new Set([cdt.id]);
  let current = cdt;
  while (current.renewedFromCdtId) {
    const previous = byId[current.renewedFromCdtId];
    if (!previous || seen.has(previous.id)) break;
    chain.unshift(previous);
    seen.add(previous.id);
    current = previous;
  }
  return chain;
}

/** Capital del nuevo periodo = valor final anterior ± aporte/retiro (research R4). */
export function renewalPrincipal(previousValue: Cents, operation: RenewalOperation, amount: Cents | null): Cents {
  const delta = operation === 'RENEW' ? 0 : (amount ?? 0);
  return (operation === 'WITHDRAW' ? previousValue - delta : previousValue + delta) as Cents;
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

/** Liquidación guardada al renovar (FR-019a), o `null` si el periodo sigue vigente. */
export function settledOf(cdt: Cdt): Settlement | null {
  if (cdt.settledGrossInterest === null || cdt.settledWithholding === null || cdt.settledNetInterest === null) return null;
  return { gross: cdt.settledGrossInterest, withholding: cdt.settledWithholding, net: cdt.settledNetInterest };
}

/** Valor final de un periodo: el liquidado si ya se renovó; si no, el esperado. */
export function periodFinalValue(cdt: Cdt): Cents {
  const settled = settledOf(cdt);
  return settled ? ((cdt.principal + settled.net) as Cents) : maturityValue(cdt);
}

export function cdtValues(cdt: Cdt, cdts: Cdt[], today: IsoDate): CdtValues {
  const settled = settledOf(cdt);
  const value = periodFinalValue(cdt);
  const byId = Object.fromEntries(cdts.map((c) => [c.id, c]));
  return {
    cdt,
    maturityValue: value,
    isOverridden: settled ? value !== maturityValue(cdt) : cdt.maturityValueOverride !== null,
    settlement: settled ?? settlement(cdt, value),
    daysElapsed: Math.max(0, Math.min(cdt.termDays, daysBetween(cdt.openedOn, today))),
    daysRemaining: Math.max(0, daysBetween(today, cdt.maturesOn)),
    maturingSoon: isMaturingSoon(cdt, today),
    canRenew: canRenew(cdt, cdts, today),
    chain: cdtChain(cdt, byId),
  };
}
