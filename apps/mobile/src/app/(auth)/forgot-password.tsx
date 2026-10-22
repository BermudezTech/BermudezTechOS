import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { AppText, Button, FormField, Screen, TextField } from '@/components/ui';
import { AuthCard } from '@/session/components/AuthCard';
import { passwordResetMessage, requestPasswordReset } from '@/session/passwordReset';
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/session/schemas';
import { useTheme } from '@/theme';

/** `/forgot-password`, paso 1: pedir el código por correo (US7). */
export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const [sent, setSent] = useState<{ email: string; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const submit = handleSubmit(async ({ email }) => {
    setError(null);
    try {
      setSent({ email, message: await requestPasswordReset(email) });
    } catch (e) {
      setError(passwordResetMessage(e));
    }
  });

  const toVerify = (email: string) => router.push({ pathname: '/verify-code', params: { email } });

  return (
    <Screen modal back fallback="/login">
      <AuthCard title="Recuperar contraseña" subtitle="Te enviaremos un código de 6 dígitos a tu correo.">
        {sent ? (
          <View style={{ gap: theme.spacing(4) }}>
            <AppText accessibilityRole="alert">{sent.message}</AppText>
            <Button label="Ya tengo el código" icon="keypad-outline" onPress={() => toVerify(sent.email)} />
          </View>
        ) : (
          <View style={{ gap: theme.spacing(4) }}>
            <Controller
              control={control}
              name="email"
              render={({ field, fieldState }) => (
                <FormField label="Correo" error={fieldState.error?.message}>
                  <TextField
                    value={field.value}
                    onChangeText={field.onChange}
                    hasError={!!fieldState.error}
                    placeholder="tu@correo.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    maxLength={254}
                    onSubmitEditing={() => submit()}
                    accessibilityLabel="Correo"
                  />
                </FormField>
              )}
            />
            {error ? (
              <AppText tone="danger" accessibilityRole="alert">
                {error}
              </AppText>
            ) : null}
            <Button label="Enviar código" icon="mail-outline" disabled={formState.isSubmitting} onPress={() => submit()} />
          </View>
        )}
      </AuthCard>
    </Screen>
  );
}
