import { resetMockData, useFinanceStore } from '../data/inMemory/store';

/** Utilidades de sesión de la implementación en memoria (Ajustes, FR-039). */
export function useSeedMode() {
  return useFinanceStore((s) => s.seedMode);
}

export { resetMockData };
