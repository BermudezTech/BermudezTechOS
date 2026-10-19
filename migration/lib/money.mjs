/**
 * Montos exactos (constitución, Principio IV): strings "1234.56" ⇄ centavos BigInt.
 * Nunca se usa `Number` para operar montos.
 */
import { MigrationError } from './errors.mjs';

const AMOUNT = /^(-?)(\d+)\.(\d{2})$/;

export function parseCents(value) {
  const match = AMOUNT.exec(value);
  if (!match) {
    throw new MigrationError(`Monto con formato inválido: "${value}"`);
  }
  const [, sign, units, cents] = match;
  const total = BigInt(units) * 100n + BigInt(cents);
  return sign ? -total : total;
}

export function absAmountString(value) {
  parseCents(value);
  return value.startsWith('-') ? value.slice(1) : value;
}

export function sumCents(values) {
  let total = 0n;
  for (const value of values) total += value;
  return total;
}

/** Formato es-CO: `.` de miles y `,` decimal (p. ej. -133.000,00). */
export function formatCents(cents) {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const units = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimals = (abs % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${units},${decimals}`;
}
