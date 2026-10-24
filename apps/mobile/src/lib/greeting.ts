import { localTimeParts } from './dates';

/** Saludo según la hora de Bogotá (FR-007; spec 007 FR-027). */
export function greetingFor(date: Date): string {
  const { hours: hour } = localTimeParts(date.toISOString());
  if (hour >= 5 && hour < 12) return 'Buenos días';
  if (hour >= 12 && hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}
