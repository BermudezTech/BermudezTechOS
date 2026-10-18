import { tz, TZDate } from '@date-fns/tz';
import { addMonths, addYears, differenceInCalendarDays, format, getDaysInMonth, startOfMonth, startOfYear } from 'date-fns';
import { es } from 'date-fns/locale';

/** Fecha y hora ISO-8601 en UTC, p. ej. "2026-10-17T14:05:00.000Z". */
export type IsoDateTime = string;
/** Fecha pura "YYYY-MM-DD". */
export type IsoDate = string;

export type Granularity = 'MONTH' | 'YEAR';
/** `anchor` es cualquier día del periodo. */
export type Period = { granularity: Granularity; anchor: IsoDate };

export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function nowUtc(): IsoDateTime {
  return new Date().toISOString();
}

export function todayLocal(zone = deviceTimeZone()): IsoDate {
  return format(new Date(), 'yyyy-MM-dd', { in: tz(zone) });
}

export function parseIsoDate(date: IsoDate): { year: number; month: number; day: number } {
  const [year, month, day] = date.split('-').map(Number);
  return { year: year ?? 1970, month: month ?? 1, day: day ?? 1 };
}

export function isoDate(year: number, month: number, day: number): IsoDate {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Instante UTC de una fecha y hora locales. */
export function localDateTimeToUtc(date: IsoDate, hours = 12, minutes = 0, zone = deviceTimeZone()): IsoDateTime {
  const { year, month, day } = parseIsoDate(date);
  return new Date(+new TZDate(year, month - 1, day, hours, minutes, zone)).toISOString();
}

/** Día local ("YYYY-MM-DD") de un instante UTC. */
export function localDayKey(value: IsoDateTime, zone = deviceTimeZone()): IsoDate {
  return format(new Date(value), 'yyyy-MM-dd', { in: tz(zone) });
}

/** Hora y minutos locales de un instante UTC. */
export function localTimeParts(value: IsoDateTime, zone = deviceTimeZone()): { hours: number; minutes: number } {
  const local = new TZDate(new Date(value), zone);
  return { hours: local.getHours(), minutes: local.getMinutes() };
}

export function formatDateLocal(value: IsoDateTime | IsoDate, pattern: string, zone = deviceTimeZone()): string {
  const date = value.length === 10 ? new TZDate(...toParts(value), zone) : new Date(value);
  return format(date, pattern, { locale: es, in: tz(zone) });
}

function toParts(date: IsoDate): [number, number, number] {
  const { year, month, day } = parseIsoDate(date);
  return [year, month - 1, day];
}

/** "Hoy", "Ayer" o "lunes 13 de octubre" (con año si no es el actual). */
export function formatRelativeDay(day: IsoDate, today: IsoDate = todayLocal()): string {
  if (day === today) return 'Hoy';
  if (day === addDays(today, -1)) return 'Ayer';
  const sameYear = day.slice(0, 4) === today.slice(0, 4);
  const label = formatDateLocal(day, sameYear ? "EEEE d 'de' MMMM" : "EEEE d 'de' MMMM 'de' yyyy");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Rango [fromUtc, toUtc) del periodo en la zona local. */
export function periodRangeUtc(period: Period, zone = deviceTimeZone()): { fromUtc: IsoDateTime; toUtc: IsoDateTime } {
  const anchor = new TZDate(...toParts(period.anchor), zone);
  const start = period.granularity === 'MONTH' ? startOfMonth(anchor) : startOfYear(anchor);
  const end = period.granularity === 'MONTH' ? addMonths(start, 1) : addYears(start, 1);
  return { fromUtc: new Date(+start).toISOString(), toUtc: new Date(+end).toISOString() };
}

export function isWithin(value: IsoDateTime, range: { fromUtc: IsoDateTime; toUtc: IsoDateTime }): boolean {
  const t = Date.parse(value);
  return t >= Date.parse(range.fromUtc) && t < Date.parse(range.toUtc);
}

export function shiftPeriod(period: Period, delta: number): Period {
  const { year, month } = parseIsoDate(period.anchor);
  if (period.granularity === 'YEAR') return { ...period, anchor: isoDate(year + delta, 1, 1) };
  const total = year * 12 + (month - 1) + delta;
  return { ...period, anchor: isoDate(Math.floor(total / 12), (total % 12) + 1, 1) };
}

export function periodLabel(period: Period): string {
  if (period.granularity === 'YEAR') return period.anchor.slice(0, 4);
  return formatDateLocal(period.anchor, 'MMMM yyyy');
}

export function periodShortLabel(period: Period): string {
  if (period.granularity === 'YEAR') return period.anchor.slice(0, 4);
  return formatDateLocal(period.anchor, 'MMM');
}

/** Aritmética de fechas puras (sin zona horaria). */
export function addDays(date: IsoDate, days: number): IsoDate {
  const t = Date.parse(`${date}T00:00:00Z`) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return differenceInCalendarDays(new Date(`${to}T00:00:00Z`), new Date(`${from}T00:00:00Z`));
}

/** Ajusta el día al último del mes si este es más corto (p. ej. 31 en febrero → 28). */
export function clampDayToMonth(year: number, month: number, day: number): number {
  return Math.min(day, getDaysInMonth(new Date(Date.UTC(year, month - 1, 1, 12))));
}

/** Fecha válida de ese mes con el día ajustado. */
export function clampedIsoDate(year: number, month: number, day: number): IsoDate {
  return isoDate(year, month, clampDayToMonth(year, month, day));
}

/** Suma meses a (año, mes 1–12). */
export function addMonthsToYearMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}
