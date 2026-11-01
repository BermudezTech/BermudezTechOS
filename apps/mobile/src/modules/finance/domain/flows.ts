import { Decimal } from 'decimal.js';

import { sub, type Cents } from '@/lib/money';

import type { CategoryKind, Transaction } from './types';

/** Variación vs. periodo anterior: porcentaje, 'new' si antes era 0, null si ambos son 0. */
export type Delta = Decimal | 'new' | null;

/**
 * Gasto personal = EXPENSE sin grupo de reembolso (data-model). Las transferencias, incluido
 * el pago de tarjeta, quedan fuera por tipo (FR-022).
 */
export function isPersonalExpense(t: Transaction): boolean {
  return !t.deletedAt && t.type === 'EXPENSE' && t.reimbursementGroupId === null;
}

/** Ingreso personal = INCOME sin grupo de reembolso (simétrico a `isPersonalExpense`). */
export function isPersonalIncome(t: Transaction): boolean {
  return !t.deletedAt && t.type === 'INCOME' && t.reimbursementGroupId === null;
}

/** Ingreso o gasto personal según el tipo de categoría; mismas reglas en todos los reportes (FR-002). */
export function isPersonalFlow(t: Transaction, kind: CategoryKind): boolean {
  return kind === 'INCOME' ? isPersonalIncome(t) : isPersonalExpense(t);
}

/** (actual − anterior) / anterior; sin anterior ⇒ 'new'. */
export function delta(current: Cents, previous: Cents): Delta {
  if (previous === 0) return current === 0 ? null : 'new';
  return new Decimal(sub(current, previous)).div(previous).mul(100);
}
