import { create } from 'zustand';

/**
 * Visibilidad de los montos de las tarjetas del hub. Solo en memoria: al abrir la app todo
 * arranca oculto. `allVisible` es el valor por defecto; `overrides` guarda lo que cada
 * tarjeta cambió con su propio ojo.
 */
interface AmountVisibilityState {
  allVisible: boolean;
  overrides: Record<string, boolean>;
  toggle: (id: string) => void;
  setAll: (visible: boolean) => void;
}

export const useAmountVisibilityStore = create<AmountVisibilityState>((set) => ({
  allVisible: false,
  overrides: {},
  toggle: (id) => set((s) => ({ overrides: { ...s.overrides, [id]: !(s.overrides[id] ?? s.allVisible) } })),
  setAll: (visible) => set({ allVisible: visible, overrides: {} }),
}));

export function useAmountVisible(id: string): boolean {
  return useAmountVisibilityStore((s) => s.overrides[id] ?? s.allVisible);
}
