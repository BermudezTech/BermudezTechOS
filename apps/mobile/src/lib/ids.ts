import * as Crypto from 'expo-crypto';

/** UUID v4 generado en el cliente (constitución, Principio I). */
export function newId(): string {
  return Crypto.randomUUID();
}
