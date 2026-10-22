import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Amount, AppText, EmptyState, GlassCard, IconButton, Screen, SectionHeader, SwitchField } from '@/components/ui';
import { AccountGroup } from '@/modules/finance/components/accounts/AccountGroup';
import { useAccountsSummary } from '@/modules/finance/hooks/useAccounts';
import { useTheme } from '@/theme';

export default function AccountsScreen() {
  const theme = useTheme();
  const [showArchived, setShowArchived] = useState(false);
  const summary = useAccountsSummary({ includeArchived: showArchived });
  const empty = summary.assets.length === 0 && summary.liabilities.length === 0;

  return (
    <Screen
      title="Cuentas"
      back
      right={<IconButton icon="add" accessibilityLabel="Nueva cuenta" onPress={() => router.push('/finance/accounts/new')} />}>
      {empty ? (
        <EmptyState
          icon="wallet-outline"
          title="Aún no tienes cuentas"
          message="Crea tu primera cuenta para empezar a registrar movimientos."
          actionLabel="Nueva cuenta"
          onAction={() => router.push('/finance/accounts/new')}
        />
      ) : (
        <>
          <GlassCard>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(4), justifyContent: 'space-between' }}>
              <View>
                <AppText variant="caption" tone="muted">
                  Disponible
                </AppText>
                <Amount value={summary.availableTotal} size="large" />
              </View>
              <View>
                <AppText variant="caption" tone="muted">
                  Deuda en tarjetas
                </AppText>
                <Amount value={summary.liabilitiesTotal} variant="debt" size="large" />
              </View>
            </View>
          </GlassCard>

          {summary.assets.length > 0 ? <SectionHeader title="Activos" /> : null}
          {summary.assets.map((group) => (
            <AccountGroup key={group.key} group={group} />
          ))}

          {summary.liabilities.length > 0 ? <SectionHeader title="Pasivos" /> : null}
          {summary.liabilities.map((group) => (
            <AccountGroup key={group.key} group={group} />
          ))}
        </>
      )}
      <GlassCard>
        <SwitchField label="Mostrar archivadas" value={showArchived} onChange={setShowArchived} />
      </GlassCard>
    </Screen>
  );
}
