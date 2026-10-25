import type { ConfigContext, ExpoConfig } from 'expo/config';

const isDevelopment = process.env.APP_VARIANT === 'development';

/** Origen de la API para `connect-src` de la CSP (sin la ruta `/api/v1`). */
function apiOrigin(): string {
  try {
    return new URL(process.env.EXPO_PUBLIC_API_URL ?? '').origin;
  } catch {
    return '';
  }
}

/**
 * CSP estricta para el hosting web (constitución, Principio III v1.1.0): sin scripts de terceros
 * ni `unsafe-inline`/`unsafe-eval` en scripts. `wasm-unsafe-eval` solo para el WASM de SQLite.
 * Los estilos inline los genera react-native-web, por eso `style-src` sí los admite.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin()}`.trim(),
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ');

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'BermudezTechOS',
  slug: 'bermudeztechos',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'bermudeztechos',
  userInterfaceStyle: 'automatic',
  // Hash de todo lo nativo (dependencias, plugins, esta config): una actualización OTA solo llega a
  // los builds con el mismo hash. Si cambia, hace falta un EAS Build nuevo.
  runtimeVersion: { policy: 'fingerprint' },
  updates: {
    url: 'https://u.expo.dev/a7794bd2-327f-48d8-8443-7587dbb33456',
  },
  ios: {
    bundleIdentifier: 'com.bermudeztech.os',
  },
  android: {
    package: 'com.bermudeztech.os',
    adaptiveIcon: {
      backgroundColor: '#FFFFFF',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'single',
    bundler: 'metro',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    [
      'expo-router',
      {
        // Cabeceras del hosting web: COOP/COEP para SQLite (research R1) y CSP (Principio III).
        headers: {
          'Cross-Origin-Embedder-Policy': 'credentialless',
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Content-Security-Policy': contentSecurityPolicy,
        },
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#FFFFFF',
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        dark: {
          backgroundColor: '#FFFFFF',
        },
      },
    ],
    '@react-native-community/datetimepicker',
    'expo-font',
    'expo-sqlite',
    ['expo-secure-store', { configureAndroidBackup: true }],
    // HTTP sin cifrar solo en desarrollo, para la API en la LAN (research R17).
    ...(isDevelopment ? [['expo-build-properties', { android: { usesCleartextTraffic: true } }] as [string, object]] : []),
  ],
  experiments: {
    typedRoutes: false,
    reactCompiler: true,
  },
  extra: {
    router: {
      asyncRoutes: {
        web: true,
      },
    },
    eas: {
      projectId: 'a7794bd2-327f-48d8-8443-7587dbb33456',
    },
  },
  owner: 'bermudeztech',
});
