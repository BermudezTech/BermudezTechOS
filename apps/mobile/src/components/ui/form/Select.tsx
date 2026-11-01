import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from '../AppText';
import { Icon, IconBadge, type IconName } from '../Icon';
import { Sheet } from '../Sheet';
import { useInputBoxStyle } from './FormField';

export type SelectOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
  icon?: IconName;
  color?: string;
};

type Props<T extends string> = {
  value: T | null;
  options: SelectOption<T>[];
  onChange: (value: T | null) => void;
  placeholder?: string;
  title?: string;
  /** Si se define, añade una opción para dejar el campo vacío. */
  clearLabel?: string;
  hasError?: boolean;
  accessibilityLabel?: string;
};

export function Select<T extends string>({
  value,
  options,
  onChange,
  placeholder = 'Seleccionar',
  title,
  clearLabel,
  hasError,
  accessibilityLabel,
}: Props<T>) {
  const theme = useTheme();
  const box = useInputBoxStyle(hasError);
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  const pick = (next: T | null) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${accessibilityLabel ?? title ?? placeholder}: ${selected?.label ?? clearLabel ?? 'sin seleccionar'}`}
        style={box}>
        {selected?.icon ? <Icon name={selected.icon} size={18} color={selected.color ?? theme.colors.textMuted} /> : null}
        <AppText style={{ flex: 1 }} tone={selected ? 'default' : 'muted'} numberOfLines={1}>
          {selected?.label ?? (value === null && clearLabel ? clearLabel : placeholder)}
        </AppText>
        <Icon name="chevron-down" size={18} color={theme.colors.textMuted} />
      </Pressable>

      <Sheet visible={open} title={title ?? placeholder} onClose={() => setOpen(false)}>
        <FlatList
          data={clearLabel ? [null, ...options] : options}
          keyExtractor={(item) => item?.value ?? '__none__'}
          contentContainerStyle={{ paddingHorizontal: theme.spacing(3), paddingBottom: theme.spacing(3) }}
          renderItem={({ item }) => {
            const isSelected = item ? item.value === value : value === null;
            return (
              <Pressable
                onPress={() => pick(item ? item.value : null)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                style={({ pressed }) => [
                  styles.option,
                  {
                    minHeight: theme.layout.minTouchTarget + 8,
                    borderRadius: theme.radii.md,
                    backgroundColor: isSelected ? theme.colors.accentSoft : pressed ? theme.colors.surfacePressed : 'transparent',
                  },
                ]}>
                {item?.icon ? <IconBadge name={item.icon} color={item.color} size={34} /> : null}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {item ? item.label : clearLabel}
                  </AppText>
                  {item?.description ? (
                    <AppText variant="caption" tone="muted" numberOfLines={1}>
                      {item.description}
                    </AppText>
                  ) : null}
                </View>
                {isSelected ? <Icon name="checkmark" size={20} color={theme.colors.accent} /> : null}
              </Pressable>
            );
          }}
        />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, paddingVertical: 6 },
});
