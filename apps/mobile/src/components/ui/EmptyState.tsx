import { router } from 'expo-router';
import { View } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { GlassCard } from './GlassCard';
import { IconBadge, type IconName } from './Icon';

type Props = {
  icon: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon, title, message, actionLabel, onAction }: Props) {
  const theme = useTheme();
  return (
    <GlassCard>
      <View style={{ alignItems: 'center', gap: theme.spacing(3), paddingVertical: theme.spacing(4) }}>
        <IconBadge name={icon} size={56} />
        <AppText variant="heading" align="center">
          {title}
        </AppText>
        {message ? (
          <AppText tone="muted" align="center">
            {message}
          </AppText>
        ) : null}
        {actionLabel && onAction ? <Button label={actionLabel} icon="add" onPress={onAction} /> : null}
      </View>
    </GlassCard>
  );
}

export function NotFound({ message = 'Este elemento no existe o fue eliminado.' }: { message?: string }) {
  return (
    <EmptyState
      icon="search-outline"
      title="No encontrado"
      message={message}
      actionLabel="Ir a Finanzas"
      onAction={() => router.replace('/finance')}
    />
  );
}
