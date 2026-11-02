import { router } from 'expo-router';
import { View } from 'react-native';

import { ListItem, Sheet, type IconName } from '@/components/ui';
import { useTheme, type Theme } from '@/theme';

import type { TransactionType } from '../../domain/types';

const OPTIONS: { type: TransactionType; label: string; subtitle: string; icon: IconName; color: (t: Theme) => string }[] = [
  { type: 'EXPENSE', label: 'Gasto', subtitle: 'Pagos y compras', icon: 'arrow-up-circle-outline', color: (t) => t.colors.expense },
  {
    type: 'INCOME',
    label: 'Ingreso',
    subtitle: 'Salario, ventas y otros',
    icon: 'arrow-down-circle-outline',
    color: (t) => t.colors.income,
  },
  {
    type: 'TRANSFER',
    label: 'Transferencia',
    subtitle: 'Entre tus cuentas',
    icon: 'swap-horizontal-outline',
    color: (t) => t.colors.transfer,
  },
];

/**
 * Menú de la acción rápida de Inicio (spec 010, US3): el tipo elegido abre el formulario con ese
 * tipo preseleccionado. Se cierra con el fondo, la X o el botón atrás de Android (`Sheet`).
 */
export function QuickActionSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  return (
    <Sheet visible={visible} title="Registrar movimiento" onClose={onClose}>
      <View style={{ paddingHorizontal: theme.spacing(2), paddingBottom: theme.spacing(3) }}>
        {OPTIONS.map((o) => (
          <ListItem
            key={o.type}
            title={o.label}
            subtitle={o.subtitle}
            icon={o.icon}
            iconColor={o.color(theme)}
            chevron
            onPress={() => {
              onClose();
              router.push({ pathname: '/quick-transaction', params: { type: o.type } });
            }}
          />
        ))}
      </View>
    </Sheet>
  );
}
