import { ApiError, NetworkError } from '@/api/errors';

import { loginErrorMessage } from './messages';

describe('loginErrorMessage', () => {
  it('credenciales inválidas: mensaje genérico', () => {
    expect(loginErrorMessage(new ApiError(401, 'INVALID_CREDENTIALS', 'x'))).toBe('Correo o contraseña incorrectos.');
  });

  it('bloqueo temporal: minutos de Retry-After', () => {
    expect(loginErrorMessage(new ApiError(429, 'TOO_MANY_ATTEMPTS', 'x', undefined, 600))).toBe(
      'Demasiados intentos. Intenta de nuevo en 10 minutos.',
    );
    expect(loginErrorMessage(new ApiError(429, 'TOO_MANY_ATTEMPTS', 'x', undefined, 30))).toBe(
      'Demasiados intentos. Intenta de nuevo en 1 minuto.',
    );
  });

  it('sin conexión y error del servidor', () => {
    expect(loginErrorMessage(new NetworkError())).toBe('Necesitas conexión para iniciar sesión.');
    expect(loginErrorMessage(new ApiError(503, 'SERVER_ERROR', 'x'))).toBe('No pudimos conectar con el servidor. Intenta más tarde.');
  });
});
