import { ScrollView } from 'react-native';

import { Sheet } from '@/components/ui';
import { useTheme } from '@/theme';

import { createCategory } from '../../data/local/categoriesRepo';
import type { Category, CategoryKind } from '../../domain/types';
import { CategoryForm } from './CategoryForm';

type Props = { visible: boolean; kind: CategoryKind; onCreated: (category: Category) => void; onClose: () => void };

/** Crear una categoría sin salir del formulario de movimientos (research R11). */
export function CategoryEditorSheet({ visible, kind, onCreated, onClose }: Props) {
  const theme = useTheme();
  return (
    <Sheet
      visible={visible}
      title={kind === 'INCOME' ? 'Nueva categoría de ingreso' : 'Nueva categoría de egreso'}
      onClose={onClose}
      maxHeight="92%">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: theme.spacing(4), paddingBottom: theme.spacing(4) }}
        keyboardShouldPersistTaps="handled">
        {visible ? (
          <CategoryForm
            fixedKind={kind}
            submitLabel="Crear"
            onCancel={onClose}
            onSubmit={async (input) => {
              const category = await createCategory(input);
              onCreated(category);
              onClose();
            }}
          />
        ) : null}
      </ScrollView>
    </Sheet>
  );
}
