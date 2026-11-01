import glyphMap from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json';

import type { IconName } from './Icon';

/** Ícono de respaldo para nombres que no existen en Ionicons (datos antiguos u otro cliente). */
export const FALLBACK_ICON: IconName = 'pricetag-outline';

export function isIconName(name: string | null | undefined): name is IconName {
  return !!name && Object.prototype.hasOwnProperty.call(glyphMap, name);
}

/** El nombre si existe en Ionicons; si no, el ícono de respaldo. */
export function safeIconName(name: string | null | undefined, fallback: IconName = FALLBACK_ICON): IconName {
  return isIconName(name) ? name : fallback;
}
