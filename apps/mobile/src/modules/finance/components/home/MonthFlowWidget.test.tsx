import { render, screen } from '@testing-library/react-native';
import { act } from 'react';

import { cents } from '@/lib/money';
import { ThemeProvider } from '@/theme';

import { clearMirror, useFinanceStore } from '../../data/local/store';
import { makeTx } from '../../domain/testUtils';
import type { Transaction } from '../../domain/types';
import { useAmountVisibilityStore } from '../../hooks/useAmountVisibility';
import { useSummaryMonthStore } from '../../hooks/useSummaryMonth';
import { MonthFlowWidget } from './MonthFlowWidget';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

function seed(transactions: Transaction[]) {
  useFinanceStore.setState({ transactions: Object.fromEntries(transactions.map((t) => [t.id, t])) });
}

async function renderWidget() {
  await render(
    <ThemeProvider>
      <MonthFlowWidget />
    </ThemeProvider>,
  );
}

describe('MonthFlowWidget', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-17T15:00:00.000Z') });
    clearMirror();
    act(() => useAmountVisibilityStore.getState().setAll(true));
  });

  afterEach(() => {
    jest.useRealTimers();
    useSummaryMonthStore.getState().setSelected(null);
  });

  it('muestra ingresos, gastos y balance del mes en curso aunque el Resumen tenga otro mes elegido', async () => {
    seed([
      makeTx({ id: 'i1', type: 'INCOME', amount: cents(500_000), on: '2026-10-02' }),
      makeTx({ id: 'e1', type: 'EXPENSE', amount: cents(120_000), on: '2026-10-05' }),
      makeTx({ id: 'e-old', type: 'EXPENSE', amount: cents(999_900), on: '2026-09-20' }),
    ]);
    useSummaryMonthStore.getState().setSelected('2026-09-01');
    await renderWidget();
    expect(screen.getByText(/octubre 2026/)).toBeTruthy();
    expect(screen.getByText('$ 5.000')).toBeTruthy();
    expect(screen.getByText('$ 1.200')).toBeTruthy();
    expect(screen.getByText('$ 3.800')).toBeTruthy();
  });

  it('sin movimientos muestra ceros', async () => {
    await renderWidget();
    expect(screen.getAllByText('$ 0')).toHaveLength(3);
  });

  it('con los montos ocultos no muestra cifras', async () => {
    seed([makeTx({ id: 'i1', type: 'INCOME', amount: cents(500_000), on: '2026-10-02' })]);
    act(() => useAmountVisibilityStore.getState().setAll(false));
    await renderWidget();
    expect(screen.queryByText('$ 5.000')).toBeNull();
    expect(screen.getAllByText('$ ******')).toHaveLength(3);
  });
});
