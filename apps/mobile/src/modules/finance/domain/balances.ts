import { cents, negate, ZERO, type Cents } from '@/lib/money';

import type { Account, Transaction } from './types';

/**
 * Saldo con signo de una cuenta (data-model, "Valores derivados"):
 *   openingBalance + ΣINCOME − ΣEXPENSE − ΣTRANSFER(sale) + ΣTRANSFER(entra)
 *
 * Para cuentas LIABILITY (tarjetas), `openingBalance` es la deuda inicial, así que el saldo
 * arranca en −openingBalance; las compras lo hacen más negativo y los pagos (transferencias
 * entrantes) lo acercan a cero. La deuda mostrada es `debtOf(saldo)` = −saldo.
 */
export function balancesByAccount(accounts: Iterable<Account>, transactions: Iterable<Transaction>): Map<string, Cents> {
  const totals = new Map<string, number>();
  for (const account of accounts) {
    if (account.deletedAt) continue;
    totals.set(account.id, account.nature === 'LIABILITY' ? -account.openingBalance : account.openingBalance);
  }
  const bump = (id: string | null, delta: number) => {
    if (id === null) return;
    const current = totals.get(id);
    if (current === undefined) return;
    totals.set(id, current + delta);
  };
  for (const tx of transactions) {
    if (tx.deletedAt) continue;
    switch (tx.type) {
      case 'INCOME':
        bump(tx.accountId, tx.amount);
        break;
      case 'EXPENSE':
        bump(tx.accountId, -tx.amount);
        break;
      case 'TRANSFER':
        bump(tx.accountId, -tx.amount);
        bump(tx.counterAccountId, tx.amount);
        break;
    }
  }
  const result = new Map<string, Cents>();
  for (const [id, value] of totals) result.set(id, cents(value));
  return result;
}

export function accountBalance(account: Account, transactions: Iterable<Transaction>): Cents {
  return balancesByAccount([account], transactions).get(account.id) ?? ZERO;
}

/** Deuda positiva de una cuenta LIABILITY a partir de su saldo con signo. */
export function debtOf(signedBalance: Cents): Cents {
  return negate(signedBalance);
}
