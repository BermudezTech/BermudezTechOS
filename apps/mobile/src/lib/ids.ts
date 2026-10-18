import * as Crypto from 'expo-crypto';

/** UUID v4 generado en el cliente (constitución, Principio I). */
export function newId(): string {
  return Crypto.randomUUID();
}

/**
 * UUID v4 válido y determinista a partir de un contador; solo para el seed de prueba,
 * para que los datos sean reproducibles entre recargas.
 */
export function seededId(n: number): string {
  const hex = n.toString(16).padStart(12, '0');
  return `5eed0000-0000-4000-8000-${hex}`;
}
