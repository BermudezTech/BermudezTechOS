import { router } from 'expo-router';

import { EmptyState, GlassCard, IconButton, Screen } from '@/components/ui';
import { RecurringIncomeListItem } from '@/modules/finance/components/recurringIncome/RecurringIncomeListItem';
import { useAccountMap } from '@/modules/finance/hooks/useAccounts';
import { useRecurringIncomes } from '@/modules/finance/hooks/useRecurringIncomes';
import { useTheme } from '@/theme';

export default function RecurringIncomesScreen() {
  const theme = useTheme();
  const items = useRecurringIncomes();
  const accounts = useAccountMap();
  const openNew = () => router.push('/finance/recurring-income/new');
  return (
    <Screen
      title="Ingresos recurrentes"
      subtitle="Salario y otros ingresos fijos"
      back
      right={<IconButton icon="add" accessibilityLabel="Nuevo ingreso recurrente" onPress={openNew} />}>
      {items.length === 0 ? (
        <EmptyState
          icon="cash-outline"
          title="Aún no tienes ingresos recurrentes"
          message="Guarda tu salario u otros ingresos fijos para registrarlos en segundos."
          actionLabel="Nuevo ingreso recurrente"
          onAction={openNew}
        />
      ) : (
        <GlassCard padded={false} style={{ padding: theme.spacing(2) }}>
          {items.map((item) => (
            <RecurringIncomeListItem key={item.id} item={item} accounts={accounts} />
          ))}
        </GlassCard>
      )}
    </Screen>
  );
}
