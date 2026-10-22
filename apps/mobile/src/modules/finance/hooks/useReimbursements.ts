import { useMemo } from 'react';

import { groupsSummary, withGroupBalance } from '../domain/reimbursements';
import { sortByDateDesc } from '../domain/transactions';
import { useActiveGroups, useActiveTransactions } from './useFinanceData';

export { createReimbursementGroup, setReimbursementGroupStatus } from '../data/local/reimbursementsRepo';

export function useReimbursementGroups() {
  const groups = useActiveGroups();
  const transactions = useActiveTransactions();
  return useMemo(() => groupsSummary(groups, transactions), [groups, transactions]);
}

export function useReimbursementGroup(id: string | undefined) {
  const groups = useActiveGroups();
  const transactions = useActiveTransactions();
  return useMemo(() => {
    const group = groups.find((g) => g.id === id);
    if (!group) return undefined;
    return {
      ...withGroupBalance(group, transactions),
      transactions: sortByDateDesc(transactions.filter((t) => t.reimbursementGroupId === group.id)),
    };
  }, [groups, transactions, id]);
}
