import { useLocalSearchParams } from 'expo-router';

import { goBack, Screen } from '@/components/ui';
import { CategoryForm } from '@/modules/finance/components/categories/CategoryForm';
import type { CategoryKind } from '@/modules/finance/domain/types';
import { createCategory } from '@/modules/finance/hooks/useCategoriesAdmin';

export default function NewCategoryScreen() {
  const { kind } = useLocalSearchParams<{ kind?: CategoryKind }>();
  return (
    <Screen title="Nueva categoría" back fallback="/finance/categories" modal>
      <CategoryForm
        defaultKind={kind === 'INCOME' ? 'INCOME' : 'EXPENSE'}
        submitLabel="Crear categoría"
        onSubmit={async (input) => {
          await createCategory(input);
          goBack('/finance/categories');
        }}
      />
    </Screen>
  );
}
