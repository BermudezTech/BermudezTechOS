import { router, useLocalSearchParams } from 'expo-router';

import { NewTransactionScreen } from '@/modules/finance/components/transactions/NewTransactionScreen';
import type { TransactionType } from '@/modules/finance/domain/types';

const TYPES: readonly TransactionType[] = ['EXPENSE', 'INCOME', 'TRANSFER'];

/**
 * Registro rápido desde Inicio (spec 010, contracts/navigation.md). Es un modal sobre las
 * pestañas: al guardar o cancelar, `dismiss` vuelve a Inicio en lugar de a Finanzas (research R2).
 */
export default function QuickTransactionRoute() {
  const params = useLocalSearchParams<{ type?: string }>();
  const type = TYPES.find((t) => t === params.type);
  return (
    <NewTransactionScreen
      defaults={{ type }}
      fallback="/"
      onCreateAccount={() => {
        router.dismiss();
        router.push('/finance/accounts/new');
      }}
    />
  );
}
