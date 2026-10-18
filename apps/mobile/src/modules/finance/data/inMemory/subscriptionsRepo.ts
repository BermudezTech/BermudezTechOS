import { subscriptionInputSchema } from '../../domain/schemas/subscription';
import { canTransition } from '../../domain/subscriptions';
import type { Subscription, SubscriptionInput, SubscriptionStatus } from '../../domain/types';
import { ValidationError } from '../FinanceRepository';
import { getEntity, insert, patch, useFinanceStore } from './store';
import { validate } from './validate';

function check(input: SubscriptionInput): SubscriptionInput {
  const valid = validate(subscriptionInputSchema, input) as SubscriptionInput;
  const state = useFinanceStore.getState();
  const account = state.accounts[valid.accountId];
  if (!account || account.deletedAt) throw new ValidationError('NOT_FOUND', 'accountId', 'La cuenta no existe.');
  if (valid.categoryId && state.categories[valid.categoryId]?.kind !== 'EXPENSE') {
    throw new ValidationError('CATEGORY_KIND_MISMATCH', 'categoryId', 'Elige una categoría de egreso.');
  }
  return valid;
}

export async function createSubscription(input: SubscriptionInput): Promise<Subscription> {
  return insert('subscriptions', check(input));
}

export async function updateSubscription(id: string, changes: Partial<SubscriptionInput>): Promise<Subscription> {
  const { id: _id, createdAt: _c, updatedAt: _u, deletedAt: _d, ...current } = getEntity('subscriptions', id);
  return patch('subscriptions', id, check({ ...current, ...changes }));
}

export async function setSubscriptionStatus(id: string, status: SubscriptionStatus): Promise<void> {
  const current = getEntity('subscriptions', id);
  if (!canTransition(current.status, status)) throw new ValidationError('INVALID_TRANSITION', 'status', 'Cambio de estado no permitido.');
  patch('subscriptions', id, { status });
}
