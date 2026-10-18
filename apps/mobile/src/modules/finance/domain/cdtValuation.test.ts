import { addDays } from '@/lib/dates';
import { cents } from '@/lib/money';

import { accruedInterest, currentValue, expectedNetAtMaturity, totalInterest, withholdingAmount } from './cdtValuation';
import { makeCdt } from './testUtils';

// CDT de $ 10.000.000 al 10,25 % E.A. a 180 días con 4 % de retención.
// Valores de referencia calculados aparte con aritmética decimal de 50 dígitos.
const cdt = makeCdt({
  principal: cents(1_000_000_000),
  annualRateEa: '10.25',
  termDays: 180,
  openedOn: '2026-01-01',
  withholdingRate: '4.00',
});

describe('cdtValuation', () => {
  it('calcula el interés causado a 0, 90 y 180 días', () => {
    expect(accruedInterest(cdt, '2026-01-01')).toBe(0);
    expect(accruedInterest(cdt, addDays('2026-01-01', 90))).toBe(24_352_702);
    expect(accruedInterest(cdt, addDays('2026-01-01', 180))).toBe(49_298_458);
  });

  it('no causa más allá del plazo ni antes de la apertura', () => {
    expect(accruedInterest(cdt, addDays('2026-01-01', 400))).toBe(49_298_458);
    expect(accruedInterest(cdt, '2025-12-01')).toBe(0);
  });

  it('calcula interés total, retención y neto al vencimiento', () => {
    expect(totalInterest(cdt)).toBe(49_298_458);
    expect(withholdingAmount(cdt)).toBe(1_971_938);
    expect(expectedNetAtMaturity(cdt)).toBe(1_047_326_520);
  });

  it('valor actual descuenta intereses ya pagados', () => {
    const today = addDays('2026-01-01', 90);
    expect(currentValue(cdt, cents(0), today)).toBe(1_000_000_000 + 24_352_702);
    expect(currentValue(cdt, cents(10_000_000), today)).toBe(1_000_000_000 + 24_352_702 - 10_000_000);
  });
});
