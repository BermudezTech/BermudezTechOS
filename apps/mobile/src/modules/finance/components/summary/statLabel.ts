import { periodLabel, type IsoDate } from '@/lib/dates';

/** "Ingresos del mes" para el mes en curso; "Ingresos · septiembre 2026" para otro mes. */
export function statLabel(name: string, month: IsoDate, isCurrent: boolean): string {
  return isCurrent ? `${name} del mes` : `${name} · ${periodLabel({ granularity: 'MONTH', anchor: month })}`;
}
