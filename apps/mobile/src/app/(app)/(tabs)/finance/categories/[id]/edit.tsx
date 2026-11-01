import { useLocalSearchParams } from 'expo-router';

import { EmptyState, goBack, Screen } from '@/components/ui';
import { CategoryForm } from '@/modules/finance/components/categories/CategoryForm';
import { updateCategory, useCategory } from '@/modules/finance/hooks/useCategoriesAdmin';

export default function EditCategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const category = useCategory(id);
  return (
    <Screen title="Editar categoría" back fallback="/finance/categories" modal>
      {category ? (
        <CategoryForm
          initial={category}
          submitLabel="Guardar cambios"
          onSubmit={async ({ name, icon, color }) => {
            await updateCategory(category.id, { name, icon, color });
            goBack('/finance/categories');
          }}
        />
      ) : (
        <EmptyState icon="pricetags-outline" title="La categoría ya no existe" message="Puede que se haya eliminado en otro dispositivo." />
      )}
    </Screen>
  );
}
