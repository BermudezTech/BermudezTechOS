import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, FadeIn, Screen } from '@/components/ui';
import { greetingFor } from '@/lib/greeting';
import { mockUser } from '@/session/mockUser';

/** Inicio: en esta fase solo muestra un saludo, sin widgets ni datos (FR-007, FR-008). */
export default function HomeScreen() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.center}>
        <FadeIn>
          <AppText variant="display" accessibilityRole="header">
            {greetingFor(now)},
          </AppText>
          <AppText variant="display" tone="accent">
            {mockUser.displayName}
          </AppText>
        </FadeIn>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', paddingVertical: 48 },
});
