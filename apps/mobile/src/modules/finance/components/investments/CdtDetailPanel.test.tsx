import { render, screen } from '@testing-library/react-native';

import { cents } from '@/lib/money';
import { ThemeProvider } from '@/theme';

import { cdtValues } from '../../domain/cdts';
import { makeCdt } from '../../domain/testUtils';
import { CdtDetailPanel } from './CdtDetailPanel';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));

describe('CdtDetailPanel', () => {
  it('muestra el historial con retención e interés neto de cada periodo', async () => {
    const first = makeCdt({
      id: 'a',
      status: 'RENEWED',
      principal: cents(1_000_000_000),
      openedOn: '2026-01-15',
      maturesOn: '2026-07-15',
      settledGrossInterest: cents(48_958_333),
      settledWithholding: cents(1_958_333),
      settledNetInterest: cents(47_000_000),
    });
    const second = makeCdt({
      id: 'b',
      renewedFromCdtId: 'a',
      sourceAccountId: null,
      principal: cents(1_047_000_000),
      openedOn: '2026-07-15',
      maturesOn: '2027-01-15',
    });

    await render(
      <ThemeProvider>
        <CdtDetailPanel values={cdtValues(second, [first, second], '2026-11-02')} accounts={new Map()} />
      </ThemeProvider>,
    );

    expect(screen.getByText('Historial')).toBeTruthy();
    expect(screen.getByText('Valor final liquidado')).toBeTruthy();
    expect(screen.getByText('Este periodo')).toBeTruthy();
    expect(screen.getAllByText('Retención').length).toBe(2);
    expect(screen.getAllByText('Interés neto').length).toBeGreaterThanOrEqual(3);
  });
});
