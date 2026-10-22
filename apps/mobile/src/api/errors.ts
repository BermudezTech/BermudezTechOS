/** Errores tipados del cliente HTTP (contracts/api-usage.md). */

/** Sin red, timeout o fallo de `fetch`. Nunca significa "sesión vencida". */
export class NetworkError extends Error {
  constructor(message = 'Sin conexión con el servidor.') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
    /** Segundos, de la cabecera `Retry-After`. */
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function isApiError(error: unknown, code?: string): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}

/** Lee el sobre común `{ error: { code, message, details } }`; 5xx o cuerpo no JSON → `SERVER_ERROR`. */
export async function parseErrorResponse(res: Response): Promise<ApiError> {
  const header = res.headers.get('Retry-After');
  const retryAfter = header !== null && /^\d+$/.test(header) ? Number(header) : undefined;
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Cuerpo vacío o no JSON.
  }
  const error = (body as { error?: { code?: unknown; message?: unknown; details?: unknown } } | null)?.error;
  if (res.status < 500 && error && typeof error.code === 'string') {
    return new ApiError(res.status, error.code, typeof error.message === 'string' ? error.message : error.code, error.details, retryAfter);
  }
  return new ApiError(res.status, 'SERVER_ERROR', 'Error del servidor.', undefined, retryAfter);
}
