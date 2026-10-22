import { Decimal } from 'decimal.js';

/**
 * Monto en centavos enteros (COP). Toda la aritmética de montos pasa por este módulo
 * para garantizar exactitud (constitución, Principio IV). Los enteros de JS son exactos
 * hasta 2^53, muy por encima del máximo permitido (MAX_CENTS).
 */
export type Cents = number & { readonly __brand: 'Cents' };

/** 999.999.999.999,99 COP */
export const MAX_CENTS = 99_999_999_999_999;

export const ZERO = 0 as Cents;

export function cents(value: number): Cents {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Monto fuera de rango o no entero: ${value}`);
  }
  // Normaliza -0 a 0.
  return (value === 0 ? 0 : value) as Cents;
}

export function add(a: Cents, b: Cents): Cents {
  return cents(a + b);
}

export function sub(a: Cents, b: Cents): Cents {
  return cents(a - b);
}

export function sum(values: Iterable<Cents>): Cents {
  let total = 0;
  for (const v of values) {
    total += v;
    if (!Number.isSafeInteger(total)) throw new RangeError('Suma fuera de rango');
  }
  return cents(total);
}

export function negate(a: Cents): Cents {
  return cents(-a);
}

export function abs(a: Cents): Cents {
  return cents(Math.abs(a));
}

export function isNegative(a: Cents): boolean {
  return a < 0;
}

export function compare(a: Cents, b: Cents): -1 | 0 | 1 {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function min(a: Cents, b: Cents): Cents {
  return a <= b ? a : b;
}

export function max(a: Cents, b: Cents): Cents {
  return a >= b ? a : b;
}

/** Convierte un Decimal expresado en centavos a `Cents`, redondeando half-up. */
export function fromDecimal(value: Decimal): Cents {
  return cents(value.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber());
}

/** Decimal en centavos, para cálculos con tasas o porcentajes. */
export function toDecimal(value: Cents): Decimal {
  return new Decimal(value);
}

/** Porcentaje (0–100) de `part` sobre `whole`, como Decimal. 0 si `whole` es 0. */
export function percentOf(part: Cents, whole: Cents): Decimal {
  if (whole === 0) return new Decimal(0);
  return new Decimal(part).div(whole).mul(100);
}

export type ParseResult = { ok: true; value: Cents } | { ok: false; code: 'AMOUNT_INVALID' };

const AMOUNT_PATTERN = /^(\d{1,12})(?:[.,](\d{1,2}))?$/;

/**
 * Convierte la entrada del usuario a centavos. Acepta `,` o `.` como separador decimal
 * (sin separador de miles). Rechaza vacío, negativos, texto, notación científica,
 * más de 2 decimales y valores por encima de MAX_CENTS. La validación de "> 0" la hace
 * cada esquema, porque algunos campos (p. ej. valor de un bien) admiten 0.
 */
export function parseAmount(input: string): ParseResult {
  const normalized = input.replace(/[\s$]/g, '');
  const match = AMOUNT_PATTERN.exec(normalized);
  if (!match) return { ok: false, code: 'AMOUNT_INVALID' };
  const integerPart = Number(match[1]);
  const fraction = Number((match[2] ?? '').padEnd(2, '0'));
  const value = integerPart * 100 + fraction;
  if (!Number.isSafeInteger(value) || value > MAX_CENTS) {
    return { ok: false, code: 'AMOUNT_INVALID' };
  }
  return { ok: true, value: cents(value) };
}

const MONEY_STRING = /^(\d{1,12})(?:\.(\d{1,2}))?$/;

/**
 * Centavos → string decimal de la API (`"1234.56"`), por texto (research R15). Los montos que se
 * sincronizan nunca son negativos.
 */
export function toMoneyString(value: Cents): string {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_CENTS) throw new RangeError(`Monto no sincronizable: ${value}`);
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}`;
}

/** String decimal de la API → centavos, sin `parseFloat` ni `Number()` sobre el decimal. */
export function fromMoneyString(value: string): Cents {
  const match = MONEY_STRING.exec(value);
  if (!match) throw new RangeError(`Monto con formato inesperado: ${JSON.stringify(value)}`);
  const integer = Number(match[1]);
  const fraction = Number((match[2] ?? '').padEnd(2, '0'));
  return cents(integer * 100 + fraction);
}

/** Representación editable (sin separador de miles), p. ej. 2500050 → "25000,50". */
export function toInputString(value: Cents): string {
  const a = Math.abs(value);
  const integer = Math.floor(a / 100);
  const fraction = a % 100;
  return fraction === 0 ? String(integer) : `${integer},${String(fraction).padStart(2, '0')}`;
}

function groupThousands(integer: number): string {
  return String(integer).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

const MINUS = '\u2212';

export type FormatOptions = {
  /** Omite ",00" cuando no hay centavos. */
  hideZeroCents?: boolean;
  /** 'auto': solo negativo; 'always': también "+"; 'never': sin signo. */
  signDisplay?: 'auto' | 'always' | 'never';
};

function signPrefix(value: Cents, signDisplay: FormatOptions['signDisplay']): string {
  if (signDisplay === 'never' || value === 0) return '';
  if (value < 0) return MINUS;
  return signDisplay === 'always' ? '+' : '';
}

/** Formato colombiano: "$ 1.234.567,89"; negativos "−$ 1.234,56". */
export function formatCop(value: Cents, options: FormatOptions = {}): string {
  const { hideZeroCents = false, signDisplay = 'auto' } = options;
  const a = Math.abs(value);
  const integer = Math.floor(a / 100);
  const fraction = a % 100;
  const decimals = hideZeroCents && fraction === 0 ? '' : `,${String(fraction).padStart(2, '0')}`;
  return `${signPrefix(value, signDisplay)}$ ${groupThousands(integer)}${decimals}`;
}

function oneDecimal(value: Decimal): string {
  const rounded = value.toDecimalPlaces(1, Decimal.ROUND_HALF_UP);
  return rounded.isInteger() ? rounded.toFixed(0) : rounded.toFixed(1).replace('.', ',');
}

/** Forma corta para tarjetas de resumen: "$ 350 mil", "$ 1,2 M", "$ 2,5 mil M". */
export function abbreviateCop(value: Cents, options: Pick<FormatOptions, 'signDisplay'> = {}): string {
  const pesos = new Decimal(Math.abs(value)).div(100);
  const sign = signPrefix(value, options.signDisplay ?? 'auto');
  if (pesos.gte(1_000_000_000)) return `${sign}$ ${oneDecimal(pesos.div(1_000_000_000))} mil M`;
  if (pesos.gte(1_000_000)) return `${sign}$ ${oneDecimal(pesos.div(1_000_000))} M`;
  if (pesos.gte(1_000)) return `${sign}$ ${oneDecimal(pesos.div(1_000))} mil`;
  return formatCop(value, { hideZeroCents: true, signDisplay: options.signDisplay });
}

/** Formatea un porcentaje Decimal: "12,5 %". */
export function formatPercent(value: Decimal, decimals = 1): string {
  const fixed = value.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toFixed(decimals);
  const trimmed = fixed.replace(/\.0+$/, '').replace('.', ',');
  return `${trimmed.replace('-', MINUS)} %`;
}
