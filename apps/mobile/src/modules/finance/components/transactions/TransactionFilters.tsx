import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, DateInput, FormField, GlassCard, Icon, Select, TextField, type IconName } from '@/components/ui';
import { useTheme } from '@/theme';

import type { TransactionFilter } from '../../data/FinanceRepository';
import type { Account, Category, TransactionType } from '../../domain/types';

type Props = {
  value: TransactionFilter;
  onChange: (patch: Partial<TransactionFilter>) => void;
  onClear: () => void;
  accounts: { account: Account; label: string }[];
  categories: Category[];
};

const typeOptions: { value: TransactionType; label: string; icon: IconName }[] = [
  { value: 'EXPENSE', label: 'Egresos', icon: 'arrow-up' },
  { value: 'INCOME', label: 'Ingresos', icon: 'arrow-down' },
  { value: 'TRANSFER', label: 'Transferencias', icon: 'swap-horizontal' },
];

/** Filtros del historial; sus valores viven en la URL (sobreviven a la recarga en web). */
export function TransactionFilters({ value, onChange, onClear, accounts, categories }: Props) {
  const theme = useTheme();
  const activeCount = [value.accountId, value.type, value.categoryId, value.from, value.to].filter(Boolean).length;
  const [open, setOpen] = useState(activeCount > 0);

  return (
    <View style={{ gap: theme.spacing(3) }}>
      <View style={{ flexDirection: 'row', gap: theme.spacing(2), alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <TextField
            value={value.search ?? ''}
            onChangeText={(search) => onChange({ search: search || undefined })}
            placeholder="Buscar por descripción"
            accessibilityLabel="Buscar movimientos"
            returnKeyType="search"
          />
        </View>
        <Pressable
          onPress={() => setOpen((o) => !o)}
          accessibilityRole="button"
          accessibilityLabel={`Filtros${activeCount ? `, ${activeCount} ${activeCount === 1 ? 'activo' : 'activos'}` : ''}`}
          accessibilityState={{ expanded: open }}
          style={{
            minWidth: theme.layout.minTouchTarget + 4,
            height: theme.layout.minTouchTarget + 4,
            borderRadius: theme.radii.md,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 4,
            paddingHorizontal: 10,
            borderWidth: 1,
            borderColor: activeCount ? theme.colors.accent : theme.colors.border,
            backgroundColor: activeCount ? theme.colors.accentSoft : theme.colors.surface,
          }}>
          <Icon name="options-outline" size={20} color={activeCount ? theme.colors.accent : theme.colors.text} />
          {activeCount ? (
            <AppText variant="bodyStrong" tone="accent">
              {activeCount}
            </AppText>
          ) : null}
        </Pressable>
      </View>

      {open ? (
        <GlassCard>
          <View style={{ gap: theme.spacing(3) }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(3) }}>
              <View style={{ flexGrow: 1, flexBasis: 220 }}>
                <FormField label="Cuenta">
                  <Select
                    title="Cuenta"
                    value={value.accountId ?? null}
                    clearLabel="Todas las cuentas"
                    options={accounts.map(({ account, label }) => ({ value: account.id, label }))}
                    onChange={(accountId) => onChange({ accountId: accountId ?? undefined })}
                  />
                </FormField>
              </View>
              <View style={{ flexGrow: 1, flexBasis: 220 }}>
                <FormField label="Tipo">
                  <Select
                    title="Tipo"
                    value={value.type ?? null}
                    clearLabel="Todos los tipos"
                    options={typeOptions}
                    onChange={(type) => onChange({ type: type ?? undefined })}
                  />
                </FormField>
              </View>
              <View style={{ flexGrow: 1, flexBasis: 220 }}>
                <FormField label="Categoría">
                  <Select
                    title="Categoría"
                    value={value.categoryId ?? null}
                    clearLabel="Todas las categorías"
                    options={[
                      { value: 'NONE', label: 'Sin categoría', icon: 'help-circle-outline' as IconName },
                      ...categories.map((c) => ({
                        value: c.id,
                        label: c.name,
                        icon: (c.icon as IconName | null) ?? undefined,
                        color: c.color ?? undefined,
                      })),
                    ]}
                    onChange={(categoryId) => onChange({ categoryId: categoryId ?? undefined })}
                  />
                </FormField>
              </View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(3) }}>
              <View style={{ flexGrow: 1, flexBasis: 160 }}>
                <FormField label="Desde">
                  <DateInput value={value.from ?? null} onChange={(from) => onChange({ from })} accessibilityLabel="Desde" />
                </FormField>
              </View>
              <View style={{ flexGrow: 1, flexBasis: 160 }}>
                <FormField label="Hasta">
                  <DateInput value={value.to ?? null} onChange={(to) => onChange({ to })} accessibilityLabel="Hasta" />
                </FormField>
              </View>
            </View>
            {activeCount ? (
              <Pressable
                onPress={onClear}
                accessibilityRole="button"
                style={{ alignSelf: 'flex-start', minHeight: theme.layout.minTouchTarget, justifyContent: 'center' }}>
                <AppText variant="bodyStrong" tone="accent">
                  Limpiar filtros
                </AppText>
              </Pressable>
            ) : null}
          </View>
        </GlassCard>
      ) : null}
    </View>
  );
}
