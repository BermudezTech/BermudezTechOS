import { Pressable, SectionList } from 'react-native';

import { AppText, Icon, Sheet } from '@/components/ui';
import { formatDateLocal, type IsoDate } from '@/lib/dates';
import { useTheme } from '@/theme';

type Props = {
  visible: boolean;
  /** Meses por año, del más reciente al más antiguo (`monthsByYear`). */
  months: { year: number; months: IsoDate[] }[];
  selected: IsoDate;
  onSelect: (month: IsoDate) => void;
  onClose: () => void;
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Lista de meses agrupada por año para saltar directo a uno (spec 008, US1). */
export function MonthPickerSheet({ visible, months, selected, onSelect, onClose }: Props) {
  const theme = useTheme();
  const sections = months.map((g) => ({ title: String(g.year), data: g.months }));
  return (
    <Sheet visible={visible} title="Elegir mes" onClose={onClose}>
      <SectionList
        sections={sections}
        keyExtractor={(month) => month}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingHorizontal: theme.spacing(3), paddingBottom: theme.spacing(3) }}
        renderSectionHeader={({ section }) => (
          <AppText
            variant="caption"
            tone="muted"
            accessibilityRole="header"
            style={{ paddingHorizontal: 10, paddingTop: theme.spacing(3), paddingBottom: theme.spacing(1) }}>
            {section.title}
          </AppText>
        )}
        renderItem={({ item }) => {
          const isSelected = item === selected;
          const label = capitalize(formatDateLocal(item, 'MMMM'));
          return (
            <Pressable
              onPress={() => {
                onSelect(item);
                onClose();
              }}
              accessibilityRole="button"
              accessibilityLabel={`${label} ${item.slice(0, 4)}`}
              accessibilityState={{ selected: isSelected }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                minHeight: theme.layout.minTouchTarget,
                paddingHorizontal: 10,
                borderRadius: theme.radii.md,
                backgroundColor: isSelected ? theme.colors.accentSoft : pressed ? theme.colors.surfacePressed : 'transparent',
              })}>
              <AppText variant="bodyStrong" style={{ flex: 1 }}>
                {label}
              </AppText>
              {isSelected ? <Icon name="checkmark" size={20} color={theme.colors.accent} /> : null}
            </Pressable>
          );
        }}
      />
    </Sheet>
  );
}
