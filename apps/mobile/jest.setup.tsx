/* eslint-disable @typescript-eslint/no-require-imports -- las fábricas de jest.mock deben usar require */
// Zona del runner: Bogotá salvo que se indique otra. `npm run test:tz` corre la suite en otras
// zonas para comprobar que la app no depende de la del dispositivo (spec 007, FR-030).
process.env.TZ = process.env.TZ || 'America/Bogota';
// URL de la API para los módulos que la leen al importarse; las pruebas nunca llaman a la red real.
process.env.EXPO_PUBLIC_API_URL = 'http://api.test/api/v1';

jest.mock('expo-crypto', () => {
  let mockCounter = 0;
  return {
    randomUUID: () => {
      mockCounter += 1;
      return `00000000-0000-4000-8000-${mockCounter.toString(16).padStart(12, '0')}`;
    },
  };
});

// Mock mínimo de Reanimated con lo que usa la app (el mock oficial requiere el runtime nativo).
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const identity = (value: unknown) => value;
  const easing = () => identity;
  return {
    __esModule: true,
    default: { View },
    View,
    useReducedMotion: () => false,
    useSharedValue: (value: unknown) => ({ value, get: () => value, set: () => {} }),
    useAnimatedStyle: () => ({}),
    withTiming: identity,
    withSpring: identity,
    withDelay: (_: number, value: unknown) => value,
    Easing: { out: easing, in: easing, cubic: identity, linear: identity },
  };
});
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// Los íconos cargan fuentes de forma asíncrona; en pruebas basta con un marcador.
jest.mock('@expo/vector-icons/Ionicons', () => {
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ name }: { name: string }) => <Text>{name}</Text> };
});
