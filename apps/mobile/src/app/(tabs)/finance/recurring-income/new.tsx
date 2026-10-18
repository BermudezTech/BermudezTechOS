import { goBack, Screen } from '@/components/ui';
import { RecurringIncomeForm } from '@/modules/finance/components/recurringIncome/RecurringIncomeForm';
import { createRecurringIncome } from '@/modules/finance/hooks/useRecurringIncomes';

export default function NewRecurringIncomeScreen() {
  return (
    <Screen title="Nuevo ingreso recurrente" back fallback="/finance/recurring-income" modal>
      <RecurringIncomeForm
        submitLabel="Crear"
        onSubmit={async (input) => {
          await createRecurringIncome(input);
          goBack('/finance/recurring-income');
        }}
      />
    </Screen>
  );
}
