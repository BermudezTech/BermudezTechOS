import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, View } from 'react-native';

import { AppText, Button, FormField, TextField } from '@/components/ui';
import { useTheme } from '@/theme';

import { loginErrorMessage } from '../messages';
import { loginSchema, type LoginValues } from '../schemas';
import { PasswordField } from './PasswordField';

type Props = {
  initialEmail?: string;
  /** Oculto en la re-autenticación (sesión vencida). */
  showForgotPassword?: boolean;
  submitLabel?: string;
  onSubmit: (values: LoginValues) => Promise<void>;
};

/** Formulario de inicio de sesión, compartido por `/login` y `/reauth`. Conserva el correo tras un error. */
export function LoginForm({ initialEmail = '', showForgotPassword = true, submitLabel = 'Iniciar sesión', onSubmit }: Props) {
  const theme = useTheme();
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState, resetField } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: initialEmail, password: '' },
  });

  const submit = handleSubmit(async (values) => {
    setError(null);
    try {
      await onSubmit(values);
    } catch (e) {
      setError(loginErrorMessage(e));
      resetField('password');
    }
  });

  return (
    <View style={{ gap: theme.spacing(4) }}>
      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <FormField label="Correo" error={fieldState.error?.message}>
            <TextField
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              hasError={!!fieldState.error}
              placeholder="tu@correo.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              maxLength={254}
              accessibilityLabel="Correo"
            />
          </FormField>
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <FormField label="Contraseña" error={fieldState.error?.message}>
            <PasswordField
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              hasError={!!fieldState.error}
              autoComplete="current-password"
              textContentType="password"
              maxLength={128}
              onSubmitEditing={() => submit()}
              accessibilityLabel="Contraseña"
            />
          </FormField>
        )}
      />
      {error ? (
        <AppText tone="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
      {formState.isSubmitting ? (
        <ActivityIndicator color={theme.colors.accent} accessibilityLabel="Iniciando sesión" />
      ) : (
        <Button label={submitLabel} icon="log-in-outline" onPress={() => submit()} />
      )}
      {showForgotPassword ? (
        <Link href="/forgot-password" style={{ alignSelf: 'center' }}>
          <AppText tone="accent">¿Olvidaste tu contraseña?</AppText>
        </Link>
      ) : null}
    </View>
  );
}
