import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { Button, confirm, goBack, NotFound, Screen } from '@/components/ui';
import { RecurringIncomeForm } from '@/modules/finance/components/recurringIncome/RecurringIncomeForm';
import {
  deleteRecurringIncome,
  setRecurringIncomeStatus,
  updateRecurringIncome,
  useRecurringIncome,
} from '@/modules/finance/hooks/useRecurringIncomes';
import { useTheme } from '@/theme';

export default function EditRecurringIncomeScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useRecurringIncome(id);

  const remove = async () => {
    if (!item) return;
    if (
      await confirm({
        title: `¿Eliminar ${item.name}?`,
        message: 'Los ingresos que ya registraste se conservan.',
        confirmLabel: 'Eliminar',
        destructive: true,
      })
    ) {
      await deleteRecurringIncome(item.id);
      goBack('/finance/recurring-income');
    }
  };

  return (
    <Screen title="Editar ingreso recurrente" back fallback="/finance/recurring-income" modal>
      {item ? (
        <View style={{ gap: theme.spacing(4) }}>
          <RecurringIncomeForm
            initial={item}
            submitLabel="Guardar cambios"
            onSubmit={async (input) => {
              await updateRecurringIncome(item.id, input);
              goBack('/finance/recurring-income');
            }}
          />
          <View style={{ flexDirection: 'row', gap: theme.spacing(2), justifyContent: 'center' }}>
            {item.status === 'ACTIVE' ? (
              <Button label="Pausar" icon="pause" variant="secondary" onPress={() => setRecurringIncomeStatus(item.id, 'PAUSED')} />
            ) : (
              <Button label="Reactivar" icon="play" variant="secondary" onPress={() => setRecurringIncomeStatus(item.id, 'ACTIVE')} />
            )}
            <Button label="Eliminar" icon="trash-outline" variant="ghost" onPress={remove} />
          </View>
        </View>
      ) : (
        <NotFound />
      )}
    </Screen>
  );
}
