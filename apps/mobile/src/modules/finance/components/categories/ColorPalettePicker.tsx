import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui';
import { useTheme } from '@/theme';

import { paletteColorLabels } from '../../categories/paletteLabels';

type Props = { value: string | null; onChange: (color: string) => void };

/** Paleta fija de colores (FR-016). Un color fuera de la paleta (datos antiguos) no marca ninguno. */
export function ColorPalettePicker({ value, onChange }: Props) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(1) }} accessibilityRole="radiogroup">
      {theme.colors.categoryPalette.map((color) => {
        const selected = value === color;
        return (
          <Pressable
            key={color}
            onPress={() => onChange(color)}
            accessibilityRole="radio"
            accessibilityLabel={paletteColorLabels[color] ?? color}
            accessibilityState={{ selected }}
            style={{
              width: theme.layout.minTouchTarget,
              height: theme.layout.minTouchTarget,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: color,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: selected ? 3 : 0,
                borderColor: theme.colors.text,
              }}>
              {selected ? <Icon name="checkmark" size={18} color="#FFFFFF" /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
