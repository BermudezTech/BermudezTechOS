import { cents } from '@/lib/money';

import { balanceLabel, canTransition, groupBalance, groupsSummary } from './reimbursements';
import { makeGroup, makeTx } from './testUtils';

describe('saldo de grupos (ejemplos de docs/db-finanzas.md §4)', () => {
  it('reembolso: −250.000 y luego saldado', () => {
    const txs = [
      makeTx({ type: 'EXPENSE', amount: cents(20_000_000), reimbursementGroupId: 'r' }),
      makeTx({ type: 'EXPENSE', amount: cents(5_000_000), reimbursementGroupId: 'r' }),
    ];
    expect(groupBalance('r', txs)).toBe(-25_000_000);
    expect(balanceLabel(groupBalance('r', txs))).toBe('Te deben');
    txs.push(makeTx({ type: 'INCOME', amount: cents(25_000_000), reimbursementGroupId: 'r' }));
    expect(groupBalance('r', txs)).toBe(0);
    expect(balanceLabel(0 as never)).toBe('Saldado');
  });

  it('adelanto: +500.000 → +80.000 → 0, o −50.000 si se gasta de más', () => {
    const txs = [
      makeTx({ type: 'INCOME', amount: cents(50_000_000), reimbursementGroupId: 'a' }),
      makeTx({ type: 'EXPENSE', amount: cents(42_000_000), reimbursementGroupId: 'a' }),
    ];
    expect(groupBalance('a', txs)).toBe(8_000_000);
    expect(balanceLabel(groupBalance('a', txs))).toBe('Tienes de terceros');
    expect(groupBalance('a', [...txs, makeTx({ type: 'EXPENSE', amount: cents(8_000_000), reimbursementGroupId: 'a' })])).toBe(0);
    expect(groupBalance('a', [...txs, makeTx({ type: 'EXPENSE', amount: cents(13_000_000), reimbursementGroupId: 'a' })])).toBe(-5_000_000);
  });
});

describe('groupsSummary y transiciones', () => {
  it('separa abiertos y cerrados y calcula los totales pendientes', () => {
    const groups = [
      makeGroup({ id: 'r' }),
      makeGroup({ id: 'a', kind: 'ADVANCE', status: 'SUBMITTED' }),
      makeGroup({ id: 's', status: 'SETTLED' }),
    ];
    const txs = [
      makeTx({ type: 'EXPENSE', amount: cents(300), reimbursementGroupId: 'r' }),
      makeTx({ type: 'INCOME', amount: cents(1_000), reimbursementGroupId: 'a' }),
    ];
    const summary = groupsSummary(groups, txs);
    expect(summary.open.map((g) => g.group.id)).toEqual(['r', 'a']);
    expect(summary.closed.map((g) => g.group.id)).toEqual(['s']);
    expect(summary.totalOwedToMe).toBe(300);
    expect(summary.totalHeldForOthers).toBe(1_000);
  });

  it('solo permite saldar con saldo 0 y respeta el flujo de estados', () => {
    expect(canTransition('OPEN', 'SETTLED', cents(-100))).toEqual({ ok: false, reason: 'GROUP_NOT_BALANCED' });
    expect(canTransition('OPEN', 'SETTLED', cents(0))).toEqual({ ok: true });
    expect(canTransition('OPEN', 'SUBMITTED', cents(-100))).toEqual({ ok: true });
    expect(canTransition('SETTLED', 'OPEN', cents(0))).toEqual({ ok: false, reason: 'INVALID_TRANSITION' });
    expect(canTransition('SUBMITTED', 'OPEN', cents(0))).toEqual({ ok: false, reason: 'INVALID_TRANSITION' });
  });
});
