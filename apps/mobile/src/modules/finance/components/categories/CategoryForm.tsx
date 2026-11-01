import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Pressable, View } from 'react-native';

import { AppText, Button, FormField, GlassCard, Icon, IconBadge, SegmentedControl, TextField } from '@/components/ui';
import { safeIconName } from '@/components/ui/iconGlyphs';
import { useTheme } from '@/theme';

import { ValidationError } from '../../data/FinanceRepository';
import type { CategoryFormInput } from '../../data/local/categoriesRepo';
import { categoryInputSchema, type CategoryFormValues } from '../../domain/schemas/category';
import type { Category, CategoryKind } from '../../domain/types';
import { ColorPalettePicker } from './ColorPalettePicker';
import { IconPickerSheet } from './IconPickerSheet';

type Props = {
  initial?: Category;
  /** Tipo preseleccionado al crear (p. ej. desde `?kind=`); editable salvo con `fixedKind`. */
  defaultKind?: CategoryKind;
  /** Tipo fijo (creación desde el formulario de movimientos). */
  fixedKind?: CategoryKind;
  onSubmit: (input: CategoryFormInput) => Promise<unknown>;
  onCancel?: () => void;
  submitLabel: string;
};

const DEFAULT_ICON = 'pricetag-outline';

/** Crear o editar una categoría: vista previa, tipo, nombre, ícono del catálogo y color de la paleta (US4). */
export function CategoryForm({ initial, defaultKind = 'EXPENSE', fixedKind, onSubmit, onCancel, submitLabel }: Props) {
  const theme = useTheme();
  const [iconsOpen, setIconsOpen] = useState(false);
  const kindLocked = !!initial || !!fixedKind;
  const { control, handleSubmit, setError, setValue, formState } = useForm<CategoryFormValues, unknown, CategoryFormInput>({
    resolver: zodResolver(categoryInputSchema(initial)),
    defaultValues: {
      name: initial?.name ?? '',
      kind: initial?.kind ?? fixedKind ?? defaultKind,
      icon: initial?.icon ?? DEFAULT_ICON,
      color: initial?.color ?? theme.colors.categoryPalette[0]!,
    },
  });
  const [name, icon, color, kind] = useWatch({ control, name: ['name', 'icon', 'color', 'kind'] });

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (error) {
      if (error instanceof ValidationError) setError((error.field as keyof CategoryFormValues) ?? 'name', { message: error.message });
      else throw error;
    }
  });

  return (
    <View style={{ gap: theme.spacing(4) }}>
      <GlassCard>
        <View
          style={{ alignItems: 'center', gap: theme.spacing(2) }}
          accessible
          accessibilityLabel={`Vista previa: ${name.trim() || 'Nueva categoría'}`}>
          <IconBadge name={safeIconName(icon)} color={color} size={72} />
          <AppText variant="heading" numberOfLines={1}>
            {name.trim() || 'Nueva categoría'}
          </AppText>
          <AppText variant="caption" tone="muted">
            {kind === 'INCOME' ? 'Ingreso' : 'Egreso'}
          </AppText>
        </View>
      </GlassCard>

      <GlassCard>
        <View style={{ gap: theme.spacing(4) }}>
          {kindLocked ? null : (
            <Controller
              control={control}
              name="kind"
              render={({ field }) => (
                <FormField label="Tipo">
                  <SegmentedControl<CategoryKind>
                    options={[
                      { value: 'EXPENSE', label: 'Egreso' },
                      { value: 'INCOME', label: 'Ingreso' },
                    ]}
                    value={field.value}
                    onChange={field.onChange}
                    accessibilityLabel="Tipo de categoría"
                  />
                </FormField>
              )}
            />
          )}
          <Controller
            control={control}
            name="name"
            render={({ field, fieldState }) => (
              <FormField label="Nombre" error={fieldState.error?.message}>
                <TextField
                  value={field.value}
                  onChangeText={field.onChange}
                  hasError={!!fieldState.error}
                  placeholder={kind === 'INCOME' ? 'Salario' : 'Mercado'}
                  maxLength={50}
                  accessibilityLabel="Nombre"
                />
              </FormField>
            )}
          />
          <Controller
            control={control}
            name="icon"
            render={({ fieldState }) => (
              <FormField label="Ícono" error={fieldState.error?.message}>
                <Pressable
                  onPress={() => setIconsOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Elegir ícono"
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing(3),
                    minHeight: theme.layout.minTouchTarget,
                    paddingHorizontal: theme.spacing(3),
                    borderRadius: theme.radii.md,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    backgroundColor: pressed ? theme.colors.surfacePressed : theme.colors.surface,
                  })}>
                  <Icon name={safeIconName(icon)} size={22} color={color} />
                  <AppText style={{ flex: 1 }}>Cambiar ícono</AppText>
                  <Icon name="chevron-forward" size={18} color={theme.colors.textMuted} />
                </Pressable>
              </FormField>
            )}
          />
          <Controller
            control={control}
            name="color"
            render={({ field, fieldState }) => (
              <FormField label="Color" error={fieldState.error?.message}>
                <ColorPalettePicker value={field.value} onChange={field.onChange} />
              </FormField>
            )}
          />
        </View>
      </GlassCard>

      <View style={{ flexDirection: 'row', gap: theme.spacing(3) }}>
        {onCancel ? (
          <View style={{ flex: 1 }}>
            <Button label="Cancelar" variant="secondary" onPress={onCancel} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Button label={submitLabel} icon="checkmark" onPress={submit} disabled={formState.isSubmitting} />
        </View>
      </View>

      <IconPickerSheet
        visible={iconsOpen}
        value={icon}
        color={color}
        onSelect={(next) => setValue('icon', next, { shouldDirty: true, shouldValidate: true })}
        onClose={() => setIconsOpen(false)}
      />
    </View>
  );
}
