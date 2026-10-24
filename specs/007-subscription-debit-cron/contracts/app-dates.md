# Contrato: fechas en la app (`apps/mobile/src/lib/dates.ts`)

Comportamiento observable del módulo de fechas con la zona fija. Las firmas existentes se mantienen. Solo cambia el valor por defecto de `zone`, se elimina `deviceTimeZone()` y se agrega `todayParts()`.

## Constante

```ts
export const APP_TIME_ZONE = 'America/Bogota';
```

Toda función que hoy recibe `zone = deviceTimeZone()` pasa a `zone = APP_TIME_ZONE`. Ningún archivo fuera de `dates.ts` lee la zona del dispositivo (`Intl.DateTimeFormat().resolvedOptions().timeZone`).

## Funciones y resultados esperados

Los ejemplos son válidos **en cualquier zona del dispositivo o del runner** (FR-024, SC-007).

| Función | Ejemplo | Resultado |
|---|---|---|
| `todayLocal()` | Instante actual `2026-10-25T04:30:00Z` | `"2026-10-24"` |
| `todayParts()` (nueva) | Mismo instante | `{ year: 2026, month: 10, day: 24 }` |
| `localDayKey(v)` | `"2026-11-01T01:00:00Z"` | `"2026-10-31"` |
| `localTimeParts(v)` | `"2026-10-25T04:30:00Z"` | `{ hours: 23, minutes: 30 }` |
| `localDateTimeToUtc(d, h, m)` | `("2026-03-10", 12, 0)` | `"2026-03-10T17:00:00.000Z"` |
| `periodRangeUtc({MONTH, "2026-10-15"})` | — | `{ fromUtc: "2026-10-01T05:00:00.000Z", toUtc: "2026-11-01T05:00:00.000Z" }` |
| `periodRangeUtc({YEAR, "2026-06-01"})` | — | `{ fromUtc: "2026-01-01T05:00:00.000Z", toUtc: "2027-01-01T05:00:00.000Z" }` |
| `formatDateLocal(v, "d 'de' MMMM HH:mm")` | `"2026-10-25T04:30:00Z"` | `"24 de octubre 23:30"` |
| `formatRelativeDay(day)` | Hoy es el 24 de octubre en Bogotá y `day = "2026-10-24"` | `"Hoy"` |

Sin cambios, porque ya son independientes de la zona: `addDays`, `daysBetween`, `clampDayToMonth`, `clampedIsoDate`, `addMonthsToYearMonth`, `shiftPeriod`, `parseIsoDate` e `isoDate`.

## Consumidores con cambio puntual

| Archivo | Comportamiento esperado |
|---|---|
| `lib/greeting.ts` | El saludo depende de la hora de Bogotá: a las `2026-10-24T23:30:00Z` (18:30 en Bogotá) dice "Buenas tardes" en cualquier zona. |
| `SubscriptionForm.tsx` / `RecurringIncomeForm.tsx` | El día propuesto al crear es `todayParts().day`. |
| `components/ui/form/DateInput.tsx` (Android) | Sin valor, el selector abre en `todayParts()`. Elegir el 10 de marzo devuelve `"YYYY-03-10"` en cualquier zona. |

## Pruebas

- `npm test` en la zona del runner.
- `npm run test:tz`: la suite completa con `TZ=Asia/Tokyo` y con `TZ=Pacific/Honolulu`. Debe pasar sin cambios en los valores esperados.
