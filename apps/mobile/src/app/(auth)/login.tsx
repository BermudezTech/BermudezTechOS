import { router, useLocalSearchParams } from 'expo-router';

import { AppText, Screen } from '@/components/ui';
import { AuthCard } from '@/session/components/AuthCard';
import { LoginForm } from '@/session/components/LoginForm';
import { takePendingRoute } from '@/session/pendingRoute';
import { signIn } from '@/session/sessionService';

/** `/login` (FR-026). Acepta `?email=` para precargar el correo y `?reset=1` tras cambiar la contraseña. */
export default function LoginScreen() {
  const { email, reset } = useLocalSearchParams<{ email?: string; reset?: string }>();

  return (
    <Screen modal>
      <AuthCard title="Iniciar sesión" subtitle="Entra para ver y sincronizar tus finanzas.">
        {reset === '1' ? (
          <AppText tone="income" style={{ marginBottom: 16 }} accessibilityRole="alert">
            Contraseña actualizada. Inicia sesión con la nueva.
          </AppText>
        ) : null}
        <LoginForm
          initialEmail={email ?? ''}
          onSubmit={async ({ email: value, password }) => {
            await signIn(value, password);
            router.replace((takePendingRoute() ?? '/') as never);
          }}
        />
      </AuthCard>
    </Screen>
  );
}
