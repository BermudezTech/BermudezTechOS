/**
 * Configuración de entorno de la app. `EXPO_PUBLIC_API_URL` se fija al compilar (ver
 * `.env.example`) e incluye `/api/v1`.
 */
function readApiBaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!raw || !/^https?:\/\/[^\s/]+/.test(raw)) {
    throw new Error('Falta EXPO_PUBLIC_API_URL o no es una URL http(s) válida. Copia apps/mobile/.env.example a .env y complétala.');
  }
  return raw.replace(/\/+$/, '');
}

export const apiBaseUrl = readApiBaseUrl();
