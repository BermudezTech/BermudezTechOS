import { router, Stack, usePathname } from 'expo-router';
import { View } from 'react-native';

import { Fab, isModalPath } from '@/components/ui';
import { useTheme } from '@/theme';

/**
 * Stack de Finanzas: las rutas `new` y `edit` se presentan como modal (contracts/navigation.md).
 * El FAB está en todas las pantallas de Finanzas salvo en los modales (FR-015).
 */
export default function FinanceLayout() {
  const theme = useTheme();
  const pathname = usePathname();

  const openNew = () => {
    // Precarga la cuenta o el grupo si se está en su detalle.
    const match = pathname.match(/^\/finance\/(accounts|reimbursements)\/([^/]+)$/);
    if (match && match[2] !== 'new') {
      const param = match[1] === 'accounts' ? 'accountId' : 'groupId';
      router.push(`/finance/transactions/new?${param}=${encodeURIComponent(match[2]!)}`);
      return;
    }
    router.push('/finance/transactions/new');
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={({ route }) => ({
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
          presentation: /(^|\/)(new|edit)$/.test(route.name) ? 'modal' : 'card',
        })}
      />
      {isModalPath(pathname) ? null : <Fab onPress={openNew} />}
    </View>
  );
}
