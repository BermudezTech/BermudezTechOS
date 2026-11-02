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

/**
 * Zona única del MVP (spec 007, FR-023): todo se calcula y se muestra en hora de Bogotá, sin
 * importar la zona del dispositivo o del navegador. Se guarda siempre en UTC.
 */
export const APP_TIME_ZONE = 'America/Bogota';

export function nowUtc(): IsoDateTime {
  return new Date().toISOString();
}

export function todayLocal(zone = APP_TIME_ZONE): IsoDate {
  return format(new Date(), 'yyyy-MM-dd', { in: tz(zone) });
}

/** Año, mes (1–12) y día de hoy en Bogotá. */
export function todayParts(zone = APP_TIME_ZONE): { year: number; month: number; day: number } {
  return parseIsoDate(todayLocal(zone));
}

export function parseIsoDate(date: IsoDate): { year: number; month: number; day: number } {
  const [year, month, day] = date.split('-').map(Number);
  return { year: year ?? 1970, month: month ?? 1, day: day ?? 1 };
}

export function isoDate(year: number, month: number, day: number): IsoDate {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Instante UTC de una fecha y hora locales. */
export function localDateTimeToUtc(date: IsoDate, hours = 12, minutes = 0, zone = APP_TIME_ZONE): IsoDateTime {
  const { year, month, day } = parseIsoDate(date);
  return new Date(+new TZDate(year, month - 1, day, hours, minutes, zone)).toISOString();
}

/** Día local ("YYYY-MM-DD") de un instante UTC. */
export function localDayKey(value: IsoDateTime, zone = APP_TIME_ZONE): IsoDate {
  return format(new Date(value), 'yyyy-MM-dd', { in: tz(zone) });
}

/** Hora y minutos locales de un instante UTC. */
export function localTimeParts(value: IsoDateTime, zone = APP_TIME_ZONE): { hours: number; minutes: number } {
  const local = new TZDate(new Date(value), zone);
  return { hours: local.getHours(), minutes: local.getMinutes() };
}

export function formatDateLocal(value: IsoDateTime | IsoDate, pattern: string, zone = APP_TIME_ZONE): string {
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
export function periodRangeUtc(period: Period, zone = APP_TIME_ZONE): { fromUtc: IsoDateTime; toUtc: IsoDateTime } {
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

/**
 * Vencimiento con días comerciales (spec 009, FR-001): cada bloque de 30 días equivale a un mes
 * calendario y los días sobrantes se suman como días calendario. Replica `helpComercialDays` del
 * usuario (incluido 31-ene + 30 → 03-mar), sin su límite de 24 meses.
 */
export function addCommercialDays(openedOn: IsoDate, termDays: number): IsoDate {
  const { year, month } = parseIsoDate(openedOn);
  const months = Math.floor(termDays / 30);
  let extra = 0;
  for (let k = 0; k < months; k++) {
    const y = year + Math.floor((month - 1 + k) / 12);
    const m = ((month - 1 + k) % 12) + 1;
    extra += new Date(Date.UTC(y, m, 0)).getUTCDate() - 30;
  }
  return addDays(openedOn, termDays + extra);
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

function monthStart(date: IsoDate): IsoDate {
  return `${date.slice(0, 7)}-01`;
}

/** Ancla canónica del periodo: primer día del mes o del año. */
function periodKey(period: Period): IsoDate {
  return period.granularity === 'YEAR' ? `${period.anchor.slice(0, 4)}-01-01` : monthStart(period.anchor);
}

export function isSamePeriod(a: Period, b: Period): boolean {
  return a.granularity === b.granularity && periodKey(a) === periodKey(b);
}

/** Ajusta un periodo a [periodo de `min`, periodo en curso]; `min` null ⇒ solo el tope superior. */
export function clampPeriod(period: Period, min: IsoDate | null, today: IsoDate = todayLocal()): Period {
  const key = periodKey(period);
  const upper = periodKey({ ...period, anchor: today });
  if (key > upper) return { ...period, anchor: upper };
  if (min) {
    const lower = periodKey({ ...period, anchor: min });
    if (key < lower) return { ...period, anchor: lower };
  }
  return period;
}

/** Meses entre `from` y `to` (primer día de cada uno), del más reciente al más antiguo, agrupados por año. */
export function monthsByYear(from: IsoDate, to: IsoDate): { year: number; months: IsoDate[] }[] {
  const groups: { year: number; months: IsoDate[] }[] = [];
  const first = monthStart(from);
  let current: Period = { granularity: 'MONTH', anchor: monthStart(to) };
  while (current.anchor >= first) {
    const year = Number(current.anchor.slice(0, 4));
    const last = groups[groups.length - 1];
    if (last?.year === year) last.months.push(current.anchor);
    else groups.push({ year, months: [current.anchor] });
    current = shiftPeriod(current, -1);
  }
  return groups;
}
