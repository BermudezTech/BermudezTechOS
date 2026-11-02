import { fireEvent, render, screen } from '@testing-library/react-native';
import { act } from 'react';

import HomeScreen from '@/app/(app)/(tabs)/index';
import { cents } from '@/lib/money';
import { useSessionStore } from '@/session/sessionStore';
import { ThemeProvider } from '@/theme';

import { clearMirror, useFinanceStore } from './finance/data/local/store';
import { makeAccount, makeTx } from './finance/domain/testUtils';
import { useAmountVisibilityStore } from './finance/hooks/useAmountVisibility';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args), canDismiss: () => false } }));

/**
 * Pantalla de Inicio (spec 010, US5). Vive fuera de `src/app/` porque Jest ignora esa carpeta
 * (Expo Router trataría el archivo de prueba como una ruta).
 */
describe('Inicio', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-17T15:00:00.000Z') });
    mockPush.mockClear();
    clearMirror();
    act(() => {
      useAmountVisibilityStore.getState().setAll(false);
      useSessionStore.setState({ profile: { id: 'u1', email: 'ana@example.com', displayName: 'Ana' } });
    });
    useFinanceStore.setState({
      accounts: { sav: makeAccount({ id: 'sav', name: 'Ahorros', openingBalance: cents(1_000_000) }) },
      transactions: { t1: makeTx({ id: 't1', accountId: 'sav', type: 'INCOME', amount: cents(250_000), on: '2026-10-05' }) },
    });
  });

  afterEach(() => jest.useRealTimers());

  async function renderHome() {
    await render(
      <ThemeProvider>
        <HomeScreen />
      </ThemeProvider>,
    );
  }

  it('muestra el saludo y los widgets en orden: Patrimonio, Este mes, Próximos vencimientos', async () => {
    await renderHome();
    expect(screen.getByText('Ana')).toBeTruthy();
    const titles = ['Patrimonio neto', 'Este mes · octubre 2026', 'Próximos vencimientos'];
    // Posición de cada título en el árbol renderizado: deben existir y aparecer en este orden.
    const tree = JSON.stringify(screen.toJSON());
    const positions = titles.map((t) => tree.indexOf(t));
    expect(positions.every((i) => i >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(screen.getByLabelText('Registrar movimiento')).toBeTruthy();
  });

  it('el ojo del encabezado muestra y oculta todos los montos', async () => {
    await renderHome();
    expect(screen.queryByText('$ 12.500')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Mostrar todos los valores'));
    // Patrimonio = 10.000 de apertura + 2.500 de ingreso.
    expect(screen.getByText('$ 12.500')).toBeTruthy();
    expect(screen.getAllByText('$ 2.500').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByLabelText('Ocultar todos los valores'));
    expect(screen.queryByText('$ 12.500')).toBeNull();
  });

  it('el botón de acción rápida ofrece Gasto, Ingreso y Transferencia y abre el formulario con el tipo', async () => {
    await renderHome();
    await fireEvent.press(screen.getByLabelText('Registrar movimiento'));
    expect(screen.getByText('Gasto')).toBeTruthy();
    expect(screen.getByText('Ingreso')).toBeTruthy();
    expect(screen.getByText('Transferencia')).toBeTruthy();
    await fireEvent.press(screen.getByText('Gasto'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/quick-transaction', params: { type: 'EXPENSE' } });
  });

  it('sin datos muestra los estados vacíos', async () => {
    act(() => clearMirror());
    await renderHome();
    expect(screen.getByText('Aún no hay patrimonio')).toBeTruthy();
    expect(screen.getByText('Nada por vencer en los próximos 15 días')).toBeTruthy();
  });
});
