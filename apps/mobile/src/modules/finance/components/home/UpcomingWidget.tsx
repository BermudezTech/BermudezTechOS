import { useState } from 'react';
import { View } from 'react-native';

import { AppText, Badge, Button, GlassCard } from '@/components/ui';
import { useInitialSync } from '@/sync/hooks';
import { useTheme } from '@/theme';

import { MATURING_SOON_DAYS } from '../../domain/cdts';
import { useAmountVisible } from '../../hooks/useAmountVisibility';
import { useUpcoming } from '../../hooks/useHomeFinance';
import { UpcomingRow } from './UpcomingRow';
import { WidgetHeader } from './WidgetHeader';

const VISIBLE_ROWS = 5;

/** Inicio → Próximos vencimientos: suscripciones, CDTs y pagos de tarjeta en los próximos 15 días (spec 010, US4). */
export function UpcomingWidget() {
  const theme = useTheme();
  const visible = useAmountVisible('home-upcoming');
  const items = useUpcoming();
  const { downloading } = useInitialSync();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, VISIBLE_ROWS);
  const urgent = items.some((i) => i.urgent);

  return (
    <GlassCard>
      <View style={{ gap: theme.spacing(2) }}>
        <WidgetHeader
          icon="notifications-outline"
          iconColor={theme.colors.warning}
          title="Próximos vencimientos"
          right={items.length > 0 ? <Badge label={String(items.length)} tone={urgent ? 'warning' : 'neutral'} /> : null}
        />
        {items.length === 0 ? (
          <AppText tone="muted">{downloading ? 'Cargando…' : `Nada por vencer en los próximos ${MATURING_SOON_DAYS} días`}</AppText>
        ) : (
          <View style={{ marginHorizontal: -theme.spacing(2) }}>
            {shown.map((item) => (
              <UpcomingRow key={`${item.kind}:${item.sourceId}`} item={item} visible={visible} />
            ))}
          </View>
        )}
        {items.length > VISIBLE_ROWS ? (
          <Button
            variant="ghost"
            compact
            label={expanded ? 'Ver menos' : `Ver todos (${items.length})`}
            onPress={() => setExpanded((e) => !e)}
          />
        ) : null}
      </View>
    </GlassCard>
  );
}
