import { ApiError, NetworkError } from '@/api/errors';

import { passwordResetMessage, requestPasswordReset, resetPassword, setResetToken, takeResetToken, verifyResetCode } from './passwordReset';

jest.mock('@/api/client', () => ({ ...jest.requireActual('@/api/client'), api: { request: jest.fn() } }));
const { api } = jest.requireMock('@/api/client') as { api: { request: jest.Mock } };

beforeEach(() => jest.clearAllMocks());

describe('recuperación de contraseña', () => {
  it('pedir código: mensaje genérico del servidor, sin sesión', async () => {
    api.request.mockResolvedValueOnce({ message: 'Si el correo existe, te enviamos un código.' });
    await expect(requestPasswordReset(' ana@example.com ')).resolves.toBe('Si el correo existe, te enviamos un código.');
    expect(api.request).toHaveBeenCalledWith('POST', '/auth/password/forgot', { auth: false, body: { email: 'ana@example.com' } });
  });

  it('validar código: devuelve el permiso; un código inválido da un mensaje genérico', async () => {
    api.request.mockResolvedValueOnce({ resetToken: 'grant', expiresIn: 600 });
    await expect(verifyResetCode('ana@example.com', '123456')).resolves.toBe('grant');
    expect(api.request).toHaveBeenCalledWith('POST', '/auth/password/verify', {
      auth: false,
      body: { email: 'ana@example.com', code: '123456' },
    });
    api.request.mockRejectedValueOnce(new ApiError(400, 'INVALID_CODE', 'x'));
    const error = await verifyResetCode('ana@example.com', '654321').catch((e: unknown) => e);
    expect(passwordResetMessage(error)).toBe('El código no es válido o venció. Pide uno nuevo.');
  });

  it('nueva contraseña: 204 resuelve; un permiso vencido da su mensaje', async () => {
    api.request.mockResolvedValueOnce(undefined);
    await expect(resetPassword('grant', 'nueva-segura')).resolves.toBeUndefined();
    expect(api.request).toHaveBeenCalledWith('POST', '/auth/password/reset', {
      auth: false,
      body: { resetToken: 'grant', newPassword: 'nueva-segura' },
    });
    api.request.mockRejectedValueOnce(new ApiError(400, 'INVALID_RESET_TOKEN', 'x'));
    const error = await resetPassword('grant', 'nueva-segura').catch((e: unknown) => e);
    expect(passwordResetMessage(error)).toBe('El permiso venció. Empieza de nuevo.');
  });

  it('valida localmente sin llamar al servidor', async () => {
    await expect(verifyResetCode('ana@example.com', '12345')).rejects.toThrow('El código tiene 6 dígitos.');
    await expect(resetPassword('grant', 'corta')).rejects.toThrow('Mínimo 8 caracteres.');
    await expect(resetPassword('grant', 'x'.repeat(129))).rejects.toThrow('Máximo 128 caracteres.');
    await expect(requestPasswordReset('no-es-correo')).rejects.toThrow('Escribe un correo válido.');
    expect(api.request).not.toHaveBeenCalled();
  });

  it('sin conexión', () => {
    expect(passwordResetMessage(new NetworkError())).toBe('Necesitas conexión.');
  });

  it('el permiso vive solo en memoria y se consume una vez', () => {
    setResetToken('grant');
    expect(takeResetToken()).toBe('grant');
    expect(takeResetToken()).toBeNull();
  });
});
