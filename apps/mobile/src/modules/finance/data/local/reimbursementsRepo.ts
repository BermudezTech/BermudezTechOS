import { canTransition, groupBalance } from '../../domain/reimbursements';
import { reimbursementGroupInputSchema } from '../../domain/schemas/reimbursementGroup';
import type { GroupStatus, ReimbursementGroup, ReimbursementGroupInput } from '../../domain/types';
import { ValidationError } from '../FinanceRepository';
import { activeList, getEntity, insert, patch, useFinanceStore } from './store';
import { validate } from './validate';

export async function createReimbursementGroup(input: ReimbursementGroupInput): Promise<ReimbursementGroup> {
  return insert('reimbursementGroups', validate(reimbursementGroupInputSchema, input) as ReimbursementGroupInput);
}

/** SETTLED solo con saldo 0 (GROUP_NOT_BALANCED); el resto según el flujo de estados. */
export async function setReimbursementGroupStatus(id: string, status: GroupStatus): Promise<void> {
  const group = getEntity('reimbursementGroups', id);
  const balance = groupBalance(id, activeList(useFinanceStore.getState().transactions));
  const result = canTransition(group.status, status, balance);
  if (!result.ok) {
    throw new ValidationError(
      result.reason,
      'status',
      result.reason === 'GROUP_NOT_BALANCED' ? 'Solo puedes saldar un grupo con saldo en cero.' : 'Cambio de estado no permitido.',
    );
  }
  await patch('reimbursementGroups', id, { status });
}
