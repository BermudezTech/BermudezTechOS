import { cents } from '@/lib/money';

import { accountBalance, balancesByAccount, debtOf } from './balances';
import { makeAccount, makeTx } from './testUtils';

describe('balancesByAccount', () => {
  const savings = makeAccount({ id: 'sav', openingBalance: cents(100_000) });
  const checking = makeAccount({ id: 'chk', type: 'CHECKING', openingBalance: cents(0) });

  it('aplica ingresos, egresos y transferencias en ambos sentidos', () => {
    const txs = [
      makeTx({ accountId: 'sav', type: 'INCOME', amount: cents(50_000) }),
      makeTx({ accountId: 'sav', type: 'EXPENSE', amount: cents(20_000) }),
      makeTx({ accountId: 'sav', counterAccountId: 'chk', type: 'TRANSFER', amount: cents(30_000) }),
      makeTx({ accountId: 'chk', counterAccountId: 'sav', type: 'TRANSFER', amount: cents(5_000) }),
    ];
    const balances = balancesByAccount([savings, checking], txs);
    expect(balances.get('sav')).toBe(100_000 + 50_000 - 20_000 - 30_000 + 5_000);
    expect(balances.get('chk')).toBe(30_000 - 5_000);
  });

  it('ignora transacciones borradas', () => {
    const txs = [makeTx({ accountId: 'sav', type: 'EXPENSE', amount: cents(99_000), deletedAt: '2026-01-01T00:00:00.000Z' })];
    expect(accountBalance(savings, txs)).toBe(100_000);
  });

  it('calcula la deuda de una tarjeta con compras y pago', () => {
    const card = makeAccount({ id: 'cc', type: 'CREDIT_CARD', openingBalance: cents(10_000) });
    const txs = [
      makeTx({ accountId: 'cc', type: 'EXPENSE', amount: cents(40_000) }),
      makeTx({ accountId: 'cc', type: 'EXPENSE', amount: cents(15_000) }),
      makeTx({ accountId: 'sav', counterAccountId: 'cc', type: 'TRANSFER', amount: cents(25_000) }),
    ];
    const balance = balancesByAccount([card, savings], txs).get('cc')!;
    expect(balance).toBe(-40_000);
    expect(debtOf(balance)).toBe(40_000);
  });
});
