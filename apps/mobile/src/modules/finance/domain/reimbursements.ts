import { negate, sub, sum, type Cents } from '@/lib/money';

import type { GroupStatus, ReimbursementGroup, Transaction } from './types';

export type BalanceLabel = 'Te deben' | 'Tienes de terceros' | 'Saldado';

export interface GroupWithBalance {
  group: ReimbursementGroup;
  balance: Cents;
  label: BalanceLabel;
  transactionCount: number;
}

export interface GroupsSummary {
  open: GroupWithBalance[];
  closed: GroupWithBalance[];
  /** Σ |saldo| de grupos abiertos con saldo negativo. */
  totalOwedToMe: Cents;
  /** Σ saldo de grupos abiertos con saldo positivo. */
  totalHeldForOthers: Cents;
}

/** Saldo del grupo = Σ INCOME − Σ EXPENSE del grupo (data-model §4). */
export function groupBalance(groupId: string, transactions: Transaction[]): Cents {
  const own = transactions.filter((t) => !t.deletedAt && t.reimbursementGroupId === groupId);
  return sub(
    sum(own.filter((t) => t.type === 'INCOME').map((t) => t.amount)),
    sum(own.filter((t) => t.type === 'EXPENSE').map((t) => t.amount)),
  );
}

/** < 0 "Te deben", > 0 "Tienes de terceros", = 0 "Saldado". */
export function balanceLabel(balance: Cents): BalanceLabel {
  if (balance < 0) return 'Te deben';
  if (balance > 0) return 'Tienes de terceros';
  return 'Saldado';
}

export function withGroupBalance(group: ReimbursementGroup, transactions: Transaction[]): GroupWithBalance {
  const balance = groupBalance(group.id, transactions);
  return {
    group,
    balance,
    label: balanceLabel(balance),
    transactionCount: transactions.filter((t) => !t.deletedAt && t.reimbursementGroupId === group.id).length,
  };
}

export function groupsSummary(groups: ReimbursementGroup[], transactions: Transaction[]): GroupsSummary {
  const all = groups.filter((g) => !g.deletedAt).map((g) => withGroupBalance(g, transactions));
  const open = all.filter((g) => g.group.status !== 'SETTLED');
  const closed = all.filter((g) => g.group.status === 'SETTLED');
  return {
    open,
    closed,
    totalOwedToMe: sum(open.filter((g) => g.balance < 0).map((g) => negate(g.balance))),
    totalHeldForOthers: sum(open.filter((g) => g.balance > 0).map((g) => g.balance)),
  };
}

/** OPEN → SUBMITTED → SETTLED ; OPEN → SETTLED (SETTLED solo si saldo = 0). */
export function canTransition(
  from: GroupStatus,
  to: GroupStatus,
  balance: Cents,
): { ok: true } | { ok: false; reason: 'INVALID_TRANSITION' | 'GROUP_NOT_BALANCED' } {
  const allowed = (from === 'OPEN' && (to === 'SUBMITTED' || to === 'SETTLED')) || (from === 'SUBMITTED' && to === 'SETTLED');
  if (!allowed) return { ok: false, reason: 'INVALID_TRANSITION' };
  if (to === 'SETTLED' && balance !== 0) return { ok: false, reason: 'GROUP_NOT_BALANCED' };
  return { ok: true };
}
