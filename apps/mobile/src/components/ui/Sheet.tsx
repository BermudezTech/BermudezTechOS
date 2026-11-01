import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { GlassSurface } from './GlassSurface';
import { Icon } from './Icon';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Altura máxima relativa a la pantalla (por defecto 80%). */
  maxHeight?: `${number}%`;
};

/** Hoja modal inferior con encabezado y botón de cerrar; se cierra tocando el fondo. */
export function Sheet({ visible, title, onClose, children, maxHeight = '80%' }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]} onPress={onClose} accessibilityLabel="Cerrar">
        <Pressable style={[styles.sheetWrap, { maxHeight, paddingBottom: insets.bottom + 12 }]} onPress={(e) => e.stopPropagation()}>
          <GlassSurface strong radius={theme.radii.xl} style={[styles.sheet, { backgroundColor: theme.colors.surfaceSolid }]}>
            <View style={[styles.header, { padding: theme.spacing(4) }]}>
              <AppText variant="heading" style={{ flex: 1 }}>
                {title}
              </AppText>
              <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={10}>
                <Icon name="close" size={22} />
              </Pressable>
            </View>
            {children}
          </GlassSurface>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheetWrap: { width: '100%', maxWidth: 560, paddingHorizontal: 12 },
  sheet: { overflow: 'hidden', flexShrink: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
});
