import { cents } from '@/lib/money';

import {
  calculatedMaturityValue,
  grossInterest,
  maturityValue,
  nominalFromEa,
  nominalFromMaturityValue,
  nominalRate,
  settlement,
} from './cdtValuation';
import { makeCdt } from './testUtils';

// CDT de $ 10.000.000 al 10 % E.A. a 180 días con 4 % de retención (quickstart, spec 009).
// Referencias calculadas aparte con Decimal de 50 dígitos y base 360.
const cdt = makeCdt({
  principal: cents(1_000_000_000),
  annualRateEa: '10.0000',
  termDays: 180,
  withholdingRate: '4.00',
});

describe('cdtValuation (base 360)', () => {
  it('calcula interés bruto y valor neto al vencimiento', () => {
    expect(grossInterest(cdt)).toBe(48_808_848);
    expect(calculatedMaturityValue(cdt)).toBe(1_046_856_494);
    expect(maturityValue(cdt)).toBe(1_046_856_494);
  });

  it('usa el valor ajustado al banco cuando existe', () => {
    expect(maturityValue({ ...cdt, maturityValueOverride: cents(1_047_000_000) })).toBe(1_047_000_000);
  });

  it('calcula la tasa nominal desde la TEA (pago al vencimiento)', () => {
    expect(nominalFromEa('10', 180)).toBe('9.7618');
    expect(nominalFromEa('10', 360)).toBe('10.0000');
    expect(nominalRate(cdt)).toBe('9.7618');
  });

  it('recalcula la nominal desde el valor final del banco', () => {
    expect(nominalFromMaturityValue(cdt, cents(1_047_000_000))).toBe('9.7917');
    expect(nominalRate({ ...cdt, maturityValueOverride: cents(1_047_000_000) })).toBe('9.7917');
    // Con el valor calculado, la nominal implícita coincide con la de la TEA.
    expect(nominalFromMaturityValue(cdt, calculatedMaturityValue(cdt))).toBe('9.7618');
  });

  it('liquida el periodo con bruto − retención = neto exacto', () => {
    expect(settlement(cdt, cents(1_047_000_000))).toEqual({ gross: 48_958_333, withholding: 1_958_333, net: 47_000_000 });

    const principals = [100_000_00, 1_000_000_00, 12_345_678_90, 250_000_000_00];
    const rates = ['0.00', '4.00', '7.00', '10.00', '20.00'];
    for (const principal of principals) {
      for (const withholdingRate of rates) {
        const terms = { ...cdt, principal: cents(principal), withholdingRate, termDays: 90 };
        const value = calculatedMaturityValue(terms);
        const { gross, withholding, net } = settlement(terms, value);
        expect(gross - withholding).toBe(net);
        expect(net).toBe(value - principal);
        expect(withholding).toBeGreaterThanOrEqual(0);
        if (withholdingRate === '0.00') expect(gross).toBe(net);
      }
    }
  });

  it('sin retención el neto es igual al bruto', () => {
    const terms = { ...cdt, withholdingRate: '0.00' };
    expect(calculatedMaturityValue(terms)).toBe(cdt.principal + grossInterest(terms));
  });
});
