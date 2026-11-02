import type { Href } from 'expo-router';

import { EmptyState, goBack, Screen } from '@/components/ui';

import type { TransactionType } from '../../domain/types';
import { useAccountOptions } from '../../hooks/useAccounts';
import { useGroupField } from '../../hooks/useGroupField';
import { useSelectableRecurringIncomes } from '../../hooks/useRecurringIncomes';
import { createTransaction, useCategories } from '../../hooks/useTransactions';
import { TransactionForm } from './TransactionForm';

type Props = {
  defaults: { type?: TransactionType; accountId?: string; reimbursementGroupId?: string; recurringIncomeId?: string };
  /** Destino al guardar o cancelar si no hay pantalla a la que volver. */
  fallback: Href;
  /** Sin cuentas: lleva al formulario de cuenta (cada ruta navega distinto, spec 010 R2). */
  onCreateAccount: () => void;
};

/**
 * Pantalla "Nuevo movimiento", compartida por `/finance/transactions/new` y por el registro
 * rápido de Inicio (`/quick-transaction`, spec 010).
 */
export function NewTransactionScreen({ defaults, fallback, onCreateAccount }: Props) {
  const accounts = useAccountOptions();
  const categories = useCategories();
  const renderGroupField = useGroupField();
  const recurringIncomes = useSelectableRecurringIncomes();
  return (
    <Screen title="Nuevo movimiento" back fallback={fallback} modal>
      {accounts.length === 0 ? (
        <EmptyState
          icon="wallet-outline"
          title="Primero crea una cuenta"
          message="Los movimientos se registran en una cuenta, tarjeta o efectivo."
          actionLabel="Nueva cuenta"
          onAction={onCreateAccount}
        />
      ) : (
        <TransactionForm
          allowCreateCategory
          accounts={accounts}
          categories={categories}
          recurringIncomes={recurringIncomes}
          defaults={defaults}
          renderGroupField={renderGroupField}
          onSubmit={async (input) => {
            await createTransaction(input);
            goBack(fallback);
          }}
        />
      )}
    </Screen>
  );
}
