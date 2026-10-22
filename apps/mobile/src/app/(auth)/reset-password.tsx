import { zodResolver } from '@hookform/resolvers/zod';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { AppText, Button, FormField, Screen } from '@/components/ui';
import { isApiError } from '@/api/errors';
import { AuthCard } from '@/session/components/AuthCard';
import { PasswordField } from '@/session/components/PasswordField';
import { passwordResetMessage, peekResetToken, resetPassword, takeResetToken } from '@/session/passwordReset';
import { resetPasswordSchema, type ResetPasswordValues } from '@/session/schemas';
import { useTheme } from '@/theme';

/** `/reset-password`, paso 3: contraseña nueva. El permiso solo vive en memoria (US7). */
export default function ResetPasswordScreen() {
  const theme = useTheme();
  const { email = '' } = useLocalSearchParams<{ email?: string }>();
  const [hasToken] = useState(() => peekResetToken() !== null);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmation: '' },
  });

  const submit = handleSubmit(async ({ password }) => {
    const token = peekResetToken();
    if (!token) return router.replace('/forgot-password');
    setError(null);
    try {
      await resetPassword(token, password);
      takeResetToken();
      router.replace({ pathname: '/login', params: { email, reset: '1' } });
    } catch (e) {
      if (isApiError(e, 'INVALID_RESET_TOKEN')) {
        takeResetToken();
        router.replace('/forgot-password');
        return;
      }
      setError(passwordResetMessage(e));
    }
  });

  // Sin permiso en memoria (recarga o enlace directo) se empieza de nuevo.
  if (!hasToken) return <Redirect href="/forgot-password" />;

  const field = (name: keyof ResetPasswordValues, label: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field: f, fieldState }) => (
        <FormField label={label} error={fieldState.error?.message}>
          <PasswordField
            value={f.value}
            onChangeText={f.onChange}
            hasError={!!fieldState.error}
            autoComplete="new-password"
            textContentType="newPassword"
            maxLength={128}
            accessibilityLabel={label}
          />
        </FormField>
      )}
    />
  );

  return (
    <Screen modal>
      <AuthCard title="Contraseña nueva" subtitle="Entre 8 y 128 caracteres.">
        <View style={{ gap: theme.spacing(4) }}>
          {field('password', 'Contraseña nueva')}
          {field('confirmation', 'Repite la contraseña')}
          {error ? (
            <AppText tone="danger" accessibilityRole="alert">
              {error}
            </AppText>
          ) : null}
          <Button label="Guardar contraseña" icon="checkmark" disabled={formState.isSubmitting} onPress={() => submit()} />
        </View>
      </AuthCard>
    </Screen>
  );
}
