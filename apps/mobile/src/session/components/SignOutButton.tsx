import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AppText, Button, confirm } from '@/components/ui';
import { useTheme } from '@/theme';

import { signOut } from '../sessionService';

/** "Cerrar sesión" (US5): sube lo pendiente y avisa de lo que se perdería. La guarda lleva a /login (N6). */
export function SignOutButton() {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    const ok = await confirm({
      title: '¿Cerrar sesión?',
      message: 'Se borrarán los datos de este dispositivo.',
      confirmLabel: 'Cerrar sesión',
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const result = await signOut();
      if (result.kind === 'pendingWouldBeLost') {
        const n = result.pendingCount;
        const lose = await confirm({
          title: 'Hay cambios sin sincronizar',
          message: `Se ${n === 1 ? 'perderá 1 cambio que no se ha' : `perderán ${n} cambios que no se han`} sincronizado.`,
          confirmLabel: 'Cerrar sesión igualmente',
          destructive: true,
        });
        if (lose) await signOut({ force: true });
      }
    } finally {
      setBusy(false);
    }
  };

  if (busy) {
    return (
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: theme.spacing(2) }}>
        <ActivityIndicator color={theme.colors.accent} />
        <AppText tone="muted">Sincronizando…</AppText>
      </View>
    );
  }
  return <Button label="Cerrar sesión" icon="log-out-outline" variant="danger" onPress={() => void run()} />;
}
