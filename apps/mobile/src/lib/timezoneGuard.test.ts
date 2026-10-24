import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * Ningún archivo fuera de `lib/dates.ts` depende de la zona del dispositivo (spec 007, FR-024).
 * Las fechas se calculan con `lib/dates.ts`, que usa `APP_TIME_ZONE`.
 */
const SRC = join(__dirname, '..');
const FORBIDDEN = [/resolvedOptions\(\)\.timeZone/, /\.getHours\(\)/, /new Date\(\)\.get(Date|Month|FullYear)\(\)/];
// El selector nativo trabaja en el calendario del dispositivo; su ida y vuelta conserva el día.
const ALLOWED = new Set(['lib/dates.ts', 'components/ui/form/DateInput.tsx']);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

it('no usa la zona ni la hora del dispositivo fuera de lib/dates.ts', () => {
  const offenders = sourceFiles(SRC)
    .map((path) => relative(SRC, path).split('\\').join('/'))
    .filter((file) => !ALLOWED.has(file))
    .filter((file) => FORBIDDEN.some((pattern) => pattern.test(readFileSync(join(SRC, file), 'utf8'))));
  expect(offenders).toEqual([]);
});
