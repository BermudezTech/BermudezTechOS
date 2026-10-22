import { router } from 'expo-router';

import { confirm, goBack, Screen } from '@/components/ui';
import { AuthCard } from '@/session/components/AuthCard';
import { LoginForm } from '@/session/components/LoginForm';
import { useSession } from '@/session/hooks';
import { signIn } from '@/session/sessionService';

/**
 * `/reauth` (modal, privada): volver a iniciar sesión con la sesión vencida (FR-031, FR-032). Con la
 * misma cuenta se conservan los datos y se suben los pendientes; con otra, se confirma el borrado.
 */
export default function ReauthScreen() {
  const { profile } = useSession();

  return (
    <Screen modal back fallback="/">
      <AuthCard title="Tu sesión venció" subtitle="Inicia sesión de nuevo para sincronizar. Tus datos siguen en este dispositivo.">
        <LoginForm
          initialEmail={profile?.email ?? ''}
          showForgotPassword={false}
          onSubmit={async ({ email, password }) => {
            const result = await signIn(email, password);
            if (result.kind === 'ownerMismatch') {
              const n = result.pendingCount;
              const ok = await confirm({
                title: 'Otra cuenta',
                message: `Vas a entrar con otra cuenta. Se borrarán los datos de este dispositivo (${n} ${
                  n === 1 ? 'cambio sin sincronizar se perderá' : 'cambios sin sincronizar se perderán'
                }).`,
                confirmLabel: 'Borrar y entrar',
                destructive: true,
              });
              if (!ok) return;
              await result.confirm();
            }
            if (router.canGoBack()) router.back();
            else goBack('/');
          }}
        />
      </AuthCard>
    </Screen>
  );
}
