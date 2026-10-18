import { useMemo } from 'react';

import { monthlyEquivalent, subscriptionsWithNext } from '../domain/subscriptions';
import { useActiveSubscriptions, useToday } from './useFinanceData';

export { createSubscription, setSubscriptionStatus, updateSubscription } from '../data/inMemory/subscriptionsRepo';

export function useSubscriptions() {
  const subs = useActiveSubscriptions();
  const today = useToday();
  return useMemo(() => ({ items: subscriptionsWithNext(subs, today), monthlyEquivalent: monthlyEquivalent(subs) }), [subs, today]);
}

export function useSubscription(id: string | undefined) {
  const subs = useActiveSubscriptions();
  return useMemo(() => subs.find((s) => s.id === id), [subs, id]);
}
