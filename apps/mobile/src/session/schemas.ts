import { z } from 'zod';

/** Validación local antes de enviar (contracts/api-usage.md): nada se envía si falla. */
const email = z.string().trim().min(1, 'Escribe tu correo.').email('Escribe un correo válido.');

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Escribe tu contraseña.').max(128, 'Máximo 128 caracteres.'),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email });
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const verifyCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'El código tiene 6 dígitos.'),
});
export type VerifyCodeValues = z.infer<typeof verifyCodeSchema>;

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'Mínimo 8 caracteres.').max(128, 'Máximo 128 caracteres.'),
    confirmation: z.string(),
  })
  .refine((v) => v.password === v.confirmation, { message: 'Las contraseñas no coinciden.', path: ['confirmation'] });
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
