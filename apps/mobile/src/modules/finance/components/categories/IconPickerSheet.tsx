import { useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, SectionList, View } from 'react-native';

import { AppText, Icon, Sheet, TextField, useIsWide } from '@/components/ui';
import { useTheme } from '@/theme';

import { ICON_CATALOG, ICON_GROUPS, type IconCatalogEntry } from '../../categories/iconCatalog';
import { searchIcons } from '../../categories/searchIcons';

type Props = {
  visible: boolean;
  value: string | null;
  /** Hexadecimal (#RRGGBB) para resaltar el ícono elegido. */
  color: string;
  onSelect: (icon: IconCatalogEntry['name']) => void;
  onClose: () => void;
};

function chunk<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));
}

/** Catálogo de íconos por grupos, con búsqueda en español (FR-015, research R6–R7). */
export function IconPickerSheet({ visible, value, color, onSelect, onClose }: Props) {
  const theme = useTheme();
  const columns = useIsWide() ? 8 : 5;
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchIcons(query), [query]);
  const sections = useMemo(
    () =>
      ICON_GROUPS.map((g) => ({
        title: g.label,
        key: g.id,
        data: chunk(
          ICON_CATALOG.filter((i) => i.group === g.id),
          columns,
        ),
      })).filter((s) => s.data.length > 0),
    [columns],
  );

  const close = () => {
    setQuery('');
    onClose();
  };

  const cell = (entry: IconCatalogEntry) => {
    const selected = entry.name === value;
    return (
      <Pressable
        key={entry.name}
        onPress={() => {
          onSelect(entry.name);
          close();
        }}
        accessibilityRole="button"
        accessibilityLabel={entry.label}
        accessibilityState={{ selected }}
        style={({ pressed }) => ({
          flex: 1,
          aspectRatio: 1,
          maxWidth: 64,
          minHeight: theme.layout.minTouchTarget,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.radii.md,
          backgroundColor: selected ? `${color}33` : pressed ? theme.colors.surfacePressed : 'transparent',
        })}>
        <Icon name={entry.name} size={24} color={selected ? color : theme.colors.text} />
      </Pressable>
    );
  };

  const row = (entries: IconCatalogEntry[]) => (
    <View style={{ flexDirection: 'row', gap: theme.spacing(1) }}>
      {entries.map(cell)}
      {Array.from({ length: columns - entries.length }, (_, i) => (
        <View key={`pad-${i}`} style={{ flex: 1, maxWidth: 64 }} />
      ))}
    </View>
  );

  return (
    <Sheet visible={visible} title="Elegir ícono" onClose={close} maxHeight="85%">
      <View style={{ paddingHorizontal: theme.spacing(4), paddingBottom: theme.spacing(2) }}>
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar: mercado, gasolina, mascota…"
          autoFocus={Platform.OS === 'web'}
          autoCorrect={false}
          accessibilityLabel="Buscar ícono"
          right={<Icon name="search" size={18} color={theme.colors.textMuted} />}
        />
      </View>
      {query.trim() ? (
        <FlatList
          data={chunk(results, columns)}
          keyExtractor={(r) => r.map((e) => e.name).join('|')}
          renderItem={({ item }) => row(item)}
          contentContainerStyle={{ paddingHorizontal: theme.spacing(3), paddingBottom: theme.spacing(3), gap: theme.spacing(1) }}
          ListEmptyComponent={
            <AppText tone="muted" align="center" style={{ padding: theme.spacing(6) }}>
              Sin íconos para «{query.trim()}»
            </AppText>
          }
          keyboardShouldPersistTaps="handled"
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(r) => r.map((e) => e.name).join('|')}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <AppText
              variant="caption"
              tone="muted"
              accessibilityRole="header"
              style={{ paddingTop: theme.spacing(3), paddingBottom: theme.spacing(1) }}>
              {section.title}
            </AppText>
          )}
          renderItem={({ item }) => <View style={{ marginBottom: theme.spacing(1) }}>{row(item)}</View>}
          contentContainerStyle={{ paddingHorizontal: theme.spacing(3), paddingBottom: theme.spacing(3) }}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </Sheet>
  );
}
