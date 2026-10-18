import { Decimal } from 'decimal.js';

import {
  abbreviateCop,
  add,
  cents,
  formatCop,
  formatPercent,
  fromDecimal,
  MAX_CENTS,
  negate,
  parseAmount,
  sub,
  sum,
  toInputString,
} from './money';

describe('aritmética', () => {
  it('es exacta en centavos (0,10 + 0,20 = 0,30)', () => {
    expect(add(cents(10), cents(20))).toBe(30);
  });

  it('suma y resta', () => {
    expect(sum([cents(100), cents(250), cents(-50)])).toBe(300);
    expect(sub(cents(100), cents(250))).toBe(-150);
    expect(negate(cents(0))).toBe(0);
    expect(Object.is(negate(cents(0)), -0)).toBe(false);
  });

  it('rechaza valores no enteros o fuera de rango', () => {
    expect(() => cents(0.5)).toThrow(RangeError);
    expect(() => cents(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });
});

describe('formatCop', () => {
  it('formatea con separadores colombianos', () => {
    expect(formatCop(cents(0))).toBe('$ 0,00');
    expect(formatCop(cents(5))).toBe('$ 0,05');
    expect(formatCop(cents(123456))).toBe('$ 1.234,56');
    expect(formatCop(cents(MAX_CENTS))).toBe('$ 999.999.999.999,99');
  });

  it('muestra negativos con signo menos', () => {
    expect(formatCop(cents(-123456))).toBe('\u2212$ 1.234,56');
    expect(formatCop(cents(5000), { signDisplay: 'always' })).toBe('+$ 50,00');
    expect(formatCop(cents(-5000), { signDisplay: 'never' })).toBe('$ 50,00');
  });

  it('puede ocultar ",00"', () => {
    expect(formatCop(cents(2500000), { hideZeroCents: true })).toBe('$ 25.000');
    expect(formatCop(cents(2500050), { hideZeroCents: true })).toBe('$ 25.000,50');
  });
});

describe('abbreviateCop', () => {
  it('abrevia miles, millones y miles de millones', () => {
    expect(abbreviateCop(cents(35_000_000))).toBe('$ 350 mil');
    expect(abbreviateCop(cents(120_000_000))).toBe('$ 1,2 M');
    expect(abbreviateCop(cents(250_000_000_000))).toBe('$ 2,5 mil M');
    expect(abbreviateCop(cents(-120_000_000))).toBe('\u2212$ 1,2 M');
    expect(abbreviateCop(cents(95_000))).toBe('$ 950');
  });
});

describe('parseAmount', () => {
  it('acepta coma o punto decimal', () => {
    expect(parseAmount('25000,50')).toEqual({ ok: true, value: 2500050 });
    expect(parseAmount('25000.5')).toEqual({ ok: true, value: 2500050 });
    expect(parseAmount(' $ 1200 ')).toEqual({ ok: true, value: 120000 });
    expect(parseAmount('0')).toEqual({ ok: true, value: 0 });
  });

  it('rechaza entradas inválidas', () => {
    for (const input of ['', '-5', '10,555', 'abc', '1e3', '1.000.000', '12,']) {
      expect(parseAmount(input)).toEqual({ ok: false, code: 'AMOUNT_INVALID' });
    }
  });

  it('respeta el límite superior', () => {
    expect(parseAmount('999999999999,99')).toEqual({ ok: true, value: MAX_CENTS });
    expect(parseAmount('1000000000000')).toEqual({ ok: false, code: 'AMOUNT_INVALID' });
  });

  it('ida y vuelta con toInputString', () => {
    expect(toInputString(cents(2500050))).toBe('25000,50');
    expect(toInputString(cents(2500000))).toBe('25000');
  });
});

describe('decimales', () => {
  it('redondea half-up a centavos', () => {
    expect(fromDecimal(new Decimal('2.5'))).toBe(3);
    expect(fromDecimal(new Decimal('2.4999'))).toBe(2);
    expect(fromDecimal(new Decimal('-2.5'))).toBe(-3);
  });

  it('formatea porcentajes', () => {
    expect(formatPercent(new Decimal('12.46'))).toBe('12,5 %');
    expect(formatPercent(new Decimal('10'))).toBe('10 %');
    expect(formatPercent(new Decimal('-3.25'))).toBe('\u22123,3 %');
  });
});
