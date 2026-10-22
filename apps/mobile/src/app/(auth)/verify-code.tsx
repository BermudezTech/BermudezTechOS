import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, View } from 'react-native';

import { AppText, Button, FormField, Screen, TextField } from '@/components/ui';
import { AuthCard } from '@/session/components/AuthCard';
import { passwordResetMessage, requestPasswordReset, setResetToken, verifyResetCode } from '@/session/passwordReset';
import { verifyCodeSchema, type VerifyCodeValues } from '@/session/schemas';
import { useTheme } from '@/theme';

/** `/verify-code?email=…`, paso 2: validar el código de 6 dígitos (US7). */
export default function VerifyCodeScreen() {
  const theme = useTheme();
  const { email = '' } = useLocalSearchParams<{ email?: string }>();
  const [notice, setNotice] = useState<{ tone: 'danger' | 'muted'; text: string } | null>(null);
  const { control, handleSubmit, formState } = useForm<VerifyCodeValues>({
    resolver: zodResolver(verifyCodeSchema),
    defaultValues: { code: '' },
  });

  const submit = handleSubmit(async ({ code }) => {
    setNotice(null);
    try {
      setResetToken(await verifyResetCode(email, code));
      router.replace({ pathname: '/reset-password', params: { email } });
    } catch (e) {
      setNotice({ tone: 'danger', text: passwordResetMessage(e) });
    }
  });

  const resend = async () => {
    try {
      setNotice({ tone: 'muted', text: await requestPasswordReset(email) });
    } catch (e) {
      setNotice({ tone: 'danger', text: passwordResetMessage(e) });
    }
  };

  return (
    <Screen modal back fallback="/forgot-password">
      <AuthCard title="Escribe el código" subtitle={email ? `Lo enviamos a ${email}.` : undefined}>
        <View style={{ gap: theme.spacing(4) }}>
          <Controller
            control={control}
            name="code"
            render={({ field, fieldState }) => (
              <FormField label="Código de 6 dígitos" error={fieldState.error?.message}>
                <TextField
                  value={field.value}
                  onChangeText={(v) => field.onChange(v.replace(/\D/g, '').slice(0, 6))}
                  hasError={!!fieldState.error}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  maxLength={6}
                  large
                  onSubmitEditing={() => submit()}
                  accessibilityLabel="Código de 6 dígitos"
                />
              </FormField>
            )}
          />
          {notice ? (
            <AppText tone={notice.tone} accessibilityRole="alert">
              {notice.text}
            </AppText>
          ) : null}
          <Button label="Continuar" icon="arrow-forward" disabled={formState.isSubmitting} onPress={() => submit()} />
          <Pressable onPress={() => void resend()} accessibilityRole="button" style={{ alignSelf: 'center' }}>
            <AppText tone="accent">Reenviar código</AppText>
          </Pressable>
        </View>
      </AuthCard>
    </Screen>
  );
}
