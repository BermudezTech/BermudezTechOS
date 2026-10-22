import { isApiError, NetworkError } from '@/api/errors';

/** Mensaje para el usuario de un error de inicio de sesión (contracts/api-usage.md). Nunca dice qué campo falló. */
export function loginErrorMessage(error: unknown): string {
  if (error instanceof NetworkError) return 'Necesitas conexión para iniciar sesión.';
  if (isApiError(error, 'INVALID_CREDENTIALS')) return 'Correo o contraseña incorrectos.';
  if (isApiError(error, 'TOO_MANY_ATTEMPTS')) {
    const minutes = Math.max(1, Math.ceil((error.retryAfter ?? 60) / 60));
    return `Demasiados intentos. Intenta de nuevo en ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}.`;
  }
  return 'No pudimos conectar con el servidor. Intenta más tarde.';
}
