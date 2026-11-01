import { create } from 'zustand';

import { clampPeriod, shiftPeriod, todayLocal, type IsoDate } from '@/lib/dates';

import { useFirstActivityMonth } from './useMonthSummary';

/**
 * Mes elegido en el Resumen, solo en memoria (al reiniciar vuelve al mes en curso). `null` = mes en
 * curso, de modo que al cambiar de mes a medianoche se pasa al nuevo sin intervención (research R1).
 */
export const useSummaryMonthStore = create<{ selected: IsoDate | null; setSelected: (month: IsoDate | null) => void }>((set) => ({
  selected: null,
  setSelected: (selected) => set({ selected }),
}));

export interface SummaryMonth {
  /** Primer día del mes mostrado. */
  month: IsoDate;
  isCurrent: boolean;
  canPrev: boolean;
  canNext: boolean;
  minMonth: IsoDate | null;
  currentMonth: IsoDate;
}

const monthOf = (date: IsoDate): IsoDate => `${date.slice(0, 7)}-01`;

/** Mes mostrado y límites de navegación, acotados a [primer mes con movimientos, mes en curso]. */
export function resolveSummaryMonth(selected: IsoDate | null, today: IsoDate, min: IsoDate | null): SummaryMonth {
  const currentMonth = monthOf(today);
  const month = selected === null ? currentMonth : clampPeriod({ granularity: 'MONTH', anchor: selected }, min, today).anchor;
  const minMonth = min === null ? null : monthOf(min);
  return {
    month,
    isCurrent: month === currentMonth,
    canPrev: minMonth !== null && month > minMonth,
    canNext: month < currentMonth,
    minMonth,
    currentMonth,
  };
}

/** Normaliza la selección: el mes en curso se guarda como `null`. */
export function toSelection(month: IsoDate, today: IsoDate): IsoDate | null {
  return monthOf(month) === monthOf(today) ? null : monthOf(month);
}

export function useSummaryMonth() {
  const selected = useSummaryMonthStore((s) => s.selected);
  const setSelected = useSummaryMonthStore((s) => s.setSelected);
  const min = useFirstActivityMonth();
  const today = todayLocal();
  const state = resolveSummaryMonth(selected, today, min);
  const go = (delta: number) => {
    const target = clampPeriod(shiftPeriod({ granularity: 'MONTH', anchor: state.month }, delta), min, today).anchor;
    setSelected(toSelection(target, today));
  };
  return {
    ...state,
    prev: () => {
      if (state.canPrev) go(-1);
    },
    next: () => {
      if (state.canNext) go(1);
    },
    select: (month: IsoDate) => setSelected(toSelection(month, today)),
    reset: () => setSelected(null),
  };
}
