/**
 * Genera las directivas `add_header` de nginx a partir de las cabeceras que `app.config.ts` declara
 * en el plugin `expo-router` (COOP/COEP para SQLite y CSP). Así la configuración de la app es la
 * única fuente de verdad y nginx no la duplica.
 *
 *   npx expo config --json --type public | node scripts/nginx-headers.mjs > headers.conf
 */
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(0, 'utf8'));
const router = (config.plugins ?? []).find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-router');
const headers = router?.[1]?.headers;

if (!headers || !headers['Cross-Origin-Embedder-Policy'] || !headers['Cross-Origin-Opener-Policy']) {
  console.error('app.config.ts no declara las cabeceras COOP/COEP en el plugin expo-router.');
  process.exit(1);
}

for (const [name, value] of Object.entries(headers)) {
  if (/["\n]/.test(value)) {
    console.error(`La cabecera ${name} contiene comillas dobles o saltos de línea.`);
    process.exit(1);
  }
  console.log(`add_header ${name} "${value}" always;`);
}
