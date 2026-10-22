import { useMemo } from 'react';

import { accountDetail, accountLabel, accountsSummary, availableTotal, withBalance } from '../domain/accounts';
import type { Account } from '../domain/types';
import { useActiveAccounts, useActiveTransactions, useBalances } from './useFinanceData';

export { archiveAccount, createAccount, deleteAccount, updateAccount } from '../data/local/accountsRepo';

/** Cuentas principales con saldo (sin cajitas). */
export function useAccounts({ includeArchived = false }: { includeArchived?: boolean } = {}) {
  const accounts = useActiveAccounts();
  const balances = useBalances();
  return useMemo(
    () =>
      accounts
        .filter((a) => a.type !== 'POCKET' && (includeArchived || !a.isArchived))
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((a) => withBalance(a, accounts, balances)),
    [accounts, balances, includeArchived],
  );
}

export function useAccount(id: string | undefined) {
  const accounts = useActiveAccounts();
  const transactions = useActiveTransactions();
  const balances = useBalances();
  return useMemo(() => {
    const account = accounts.find((a) => a.id === id);
    return account ? accountDetail(account, accounts, balances, transactions) : undefined;
  }, [accounts, balances, transactions, id]);
}

export function useAccountsSummary({ includeArchived = false }: { includeArchived?: boolean } = {}) {
  const accounts = useActiveAccounts();
  const balances = useBalances();
  return useMemo(() => accountsSummary(accounts, balances, { includeArchived }), [accounts, balances, includeArchived]);
}

export function useAvailableTotal() {
  const accounts = useActiveAccounts();
  const balances = useBalances();
  return useMemo(() => availableTotal(accounts, balances), [accounts, balances]);
}

export type AccountOption = { account: Account; label: string };

/** Cuentas no archivadas (incluye cajitas) para selectores de formularios. */
export function useAccountOptions(filter?: (a: Account) => boolean): AccountOption[] {
  const accounts = useActiveAccounts();
  return useMemo(
    () =>
      accounts
        .filter((a) => !a.isArchived && (!filter || filter(a)))
        .sort((a, b) => {
          const rootOrder = (x: Account) => accounts.find((p) => p.id === (x.parentAccountId ?? x.id))?.sortOrder ?? x.sortOrder;
          return rootOrder(a) - rootOrder(b) || Number(!!a.parentAccountId) - Number(!!b.parentAccountId) || a.sortOrder - b.sortOrder;
        })
        .map((a) => ({ account: a, label: accountLabel(a, accounts) })),
    // `filter` suele ser una función nueva en cada render; la lista depende solo de las cuentas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accounts],
  );
}

/** Mapa id → cuenta, para mostrar nombres en listas. */
export function useAccountMap() {
  const accounts = useActiveAccounts();
  return useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
}
