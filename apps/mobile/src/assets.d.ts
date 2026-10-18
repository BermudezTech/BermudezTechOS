// Imports de imágenes (Metro los resuelve a un id de recurso). `tsconfig` limita `types` a jest,
// así que se declaran aquí.
declare module '*.png' {
  import type { ImageSourcePropType } from 'react-native';
  const source: ImageSourcePropType;
  export default source;
}
