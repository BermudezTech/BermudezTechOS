import { View } from 'react-native';

import { Amount, AppText, GlassCard, ProgressBar } from '@/components/ui';
import { formatPercent } from '@/lib/money';
import { useTheme } from '@/theme';

import type { Account } from '../../domain/types';
import type { CreditCardMetrics } from '../../domain/accounts';

export function CreditCardPanel({ account, metrics }: { account: Account; metrics: CreditCardMetrics }) {
  const theme = useTheme();
  const used = metrics.usedPct.toNumber() / 100;
  const color = used >= 0.9 ? theme.colors.danger : used >= 0.7 ? theme.colors.warning : theme.colors.accent;
  return (
    <GlassCard>
      <View style={{ gap: theme.spacing(3) }}>
        <View>
          <AppText variant="caption" tone="muted">
            Deuda actual
          </AppText>
          <Amount value={metrics.debt} variant="debt" size="large" />
        </View>
        <ProgressBar value={used} color={color} accessibilityLabel={`Cupo usado: ${formatPercent(metrics.usedPct)}`} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing(3), flexWrap: 'wrap' }}>
          <Stat label="Cupo total">
            <Amount value={metrics.creditLimit} />
          </Stat>
          <Stat label="Cupo disponible">
            <Amount value={metrics.availableCredit} />
          </Stat>
          <Stat label="Usado">
            <AppText variant="amount">{formatPercent(metrics.usedPct)}</AppText>
          </Stat>
        </View>
        <AppText tone="muted">
          Corte: día {account.statementDay ?? '—'} · Pago: día {account.paymentDueDay ?? '—'}
        </AppText>
      </View>
    </GlassCard>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ minWidth: 96 }}>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
      {children}
    </View>
  );
}
