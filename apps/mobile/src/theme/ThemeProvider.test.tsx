import { fireEvent, render, screen } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { Pressable, Text } from 'react-native';

import { ThemeProvider, useTheme, useThemeMode } from './ThemeProvider';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItem: jest.fn((key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    __store: store,
  };
});

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;

function Probe() {
  const theme = useTheme();
  const { mode, setMode } = useThemeMode();
  return (
    <>
      <Text>{`${mode}:${theme.scheme}`}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Oscuro" onPress={() => setMode('dark')} />
    </>
  );
}

const mount = () =>
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );

beforeEach(() => store.clear());

describe('ThemeProvider · persistencia del tema', () => {
  it('sin preferencia guardada usa el tema del sistema', async () => {
    await mount();
    expect(screen.getByText(/^system:/)).toBeTruthy();
  });

  it('guarda el tema elegido y lo recupera al volver a abrir la app', async () => {
    const first = await mount();
    await fireEvent.press(screen.getByLabelText('Oscuro'));
    expect(screen.getByText('dark:dark')).toBeTruthy();
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('bt.themeMode', 'dark');
    await first.unmount();

    await mount();
    expect(screen.getByText('dark:dark')).toBeTruthy();
  });

  it('ignora un valor guardado inválido', async () => {
    store.set('bt.themeMode', 'morado');
    await mount();
    expect(screen.getByText(/^system:/)).toBeTruthy();
  });
});
