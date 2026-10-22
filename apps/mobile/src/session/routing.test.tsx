import { router, Stack } from 'expo-router';
import { act, renderRouter, screen } from 'expo-router/testing-library';
import { Text, View } from 'react-native';

import { rememberRoute, takePendingRoute } from './pendingRoute';
import { useSessionStore } from './sessionStore';

/** Árbol que reproduce contracts/navigation.md con la misma guarda que `src/app/_layout.tsx`. */
function RootLayout() {
  const status = useSessionStore((s) => s.status);
  if (status === 'loading') return null;
  const signedIn = status === 'signedIn';
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={signedIn} redirectTo="/login">
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

const page = (label: string) =>
  function Page() {
    return (
      <View>
        <Text>{label}</Text>
      </View>
    );
  };

const routes = {
  _layout: RootLayout,
  '(app)/_layout': () => <Stack screenOptions={{ headerShown: false }} />,
  '(app)/index': page('Inicio'),
  '(app)/finance/accounts/index': page('Cuentas'),
  '(auth)/_layout': () => <Stack screenOptions={{ headerShown: false }} />,
  '(auth)/login': page('Login'),
};

async function signIn() {
  await act(async () => {
    useSessionStore.setState({ status: 'signedIn', profile: { id: 'u1', email: 'a@b.co', displayName: null } });
  });
  await act(async () => {
    router.replace((takePendingRoute() ?? '/') as never);
  });
}

/**
 * ¿Está montada la pantalla? El stack nativo marca como ocultas las pantallas durante la
 * transición; se cuentan igual, lo que además comprueba que una privada no quede montada.
 */
const mounted = (text: string) => screen.queryByText(text, { includeHiddenElements: true }) !== null;

beforeEach(() => {
  takePendingRoute();
  useSessionStore.setState({ status: 'signedOut', expired: false, profile: null });
});

describe('guarda de rutas', () => {
  it('N1: mientras carga no se renderiza ninguna ruta', async () => {
    useSessionStore.setState({ status: 'loading' });
    await renderRouter(routes, { initialUrl: '/finance/accounts' });
    expect(mounted('Cuentas')).toBe(false);
    expect(mounted('Login')).toBe(false);
  });

  it('N2: sin sesión, un enlace directo a una ruta privada muestra el login', async () => {
    const view = await renderRouter(routes, { initialUrl: '/finance/accounts' });
    expect(mounted('Login')).toBe(true);
    expect(mounted('Cuentas')).toBe(false);
    expect(view.getPathname()).toBe('/login');
  });

  it('N3: tras iniciar sesión lleva a la ruta pedida', async () => {
    rememberRoute('/finance/accounts');
    const view = await renderRouter(routes, { initialUrl: '/finance/accounts' });
    await signIn();
    expect(mounted('Cuentas')).toBe(true);
    expect(view.getPathname()).toBe('/finance/accounts');
  });

  it('N3: sin ruta pendiente lleva a Inicio', async () => {
    const view = await renderRouter(routes, { initialUrl: '/login' });
    await signIn();
    expect(view.getPathname()).toBe('/');
  });

  it('N4: con sesión, /login redirige a Inicio', async () => {
    useSessionStore.setState({ status: 'signedIn' });
    const view = await renderRouter(routes, { initialUrl: '/login' });
    expect(mounted('Inicio')).toBe(true);
    expect(view.getPathname()).toBe('/');
  });

  it('N6: cerrar sesión elimina la historia privada', async () => {
    useSessionStore.setState({ status: 'signedIn' });
    await renderRouter(routes, { initialUrl: '/' });
    await act(async () => router.push('/finance/accounts'));
    expect(mounted('Cuentas')).toBe(true);
    await act(async () => useSessionStore.setState({ status: 'signedOut', profile: null }));
    expect(mounted('Login')).toBe(true);
    expect(mounted('Cuentas')).toBe(false);
    expect(router.canGoBack()).toBe(false);
  });
});

it('rememberRoute ignora las rutas públicas y la raíz', () => {
  rememberRoute('/login');
  rememberRoute('/');
  rememberRoute('/reset-password?x=1');
  expect(takePendingRoute()).toBeNull();
  rememberRoute('/finance?period=2026-10');
  expect(takePendingRoute()).toBe('/finance?period=2026-10');
});
