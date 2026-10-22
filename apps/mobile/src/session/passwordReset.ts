import { api } from '@/api/client';
import { isApiError, NetworkError } from '@/api/errors';

import { forgotPasswordSchema, resetPasswordSchema, verifyCodeSchema } from './schemas';

/** Error de validación local: el formulario lo muestra sin llamar al servidor. */
export class ResetValidationError extends Error {
  name = 'ResetValidationError';
}

function check<T>(result: { success: true; data: T } | { success: false; error: { issues: { message: string }[] } }): T {
  if (!result.success) throw new ResetValidationError(result.error.issues[0]?.message ?? 'Datos inválidos.');
  return result.data;
}

/** Paso 1: siempre el mismo mensaje, exista o no la cuenta (FR-034). */
export async function requestPasswordReset(email: string): Promise<string> {
  const valid = check(forgotPasswordSchema.safeParse({ email }));
  const res = await api.request<{ message: string }>('POST', '/auth/password/forgot', { auth: false, body: { email: valid.email } });
  return res.message;
}

/** Paso 2: el código de 6 dígitos devuelve un permiso de corta duración. */
export async function verifyResetCode(email: string, code: string): Promise<string> {
  const valid = check(verifyCodeSchema.safeParse({ code }));
  const res = await api.request<{ resetToken: string }>('POST', '/auth/password/verify', {
    auth: false,
    body: { email: email.trim(), code: valid.code },
  });
  return res.resetToken;
}

/** Paso 3: contraseña nueva de 8 a 128 caracteres. */
export async function resetPassword(resetToken: string, newPassword: string): Promise<void> {
  check(resetPasswordSchema.safeParse({ password: newPassword, confirmation: newPassword }));
  await api.request<void>('POST', '/auth/password/reset', { auth: false, body: { resetToken, newPassword } });
}

/** Mensaje para el usuario (contracts/api-usage.md); nunca revela si el correo existe. */
export function passwordResetMessage(error: unknown): string {
  if (error instanceof ResetValidationError) return error.message;
  if (error instanceof NetworkError) return 'Necesitas conexión.';
  if (isApiError(error, 'INVALID_CODE')) return 'El código no es válido o venció. Pide uno nuevo.';
  if (isApiError(error, 'INVALID_RESET_TOKEN')) return 'El permiso venció. Empieza de nuevo.';
  if (isApiError(error, 'VALIDATION_ERROR')) return 'Revisa los datos e intenta de nuevo.';
  return 'No pudimos conectar con el servidor. Intenta más tarde.';
}

/** El permiso vive solo en memoria entre los pasos 2 y 3; nunca se guarda. */
let resetToken: string | null = null;

export function setResetToken(token: string): void {
  resetToken = token;
}

export function takeResetToken(): string | null {
  const token = resetToken;
  resetToken = null;
  return token;
}

export function peekResetToken(): string | null {
  return resetToken;
}
