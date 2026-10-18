import { TabList, Tabs, TabSlot, TabTrigger } from 'expo-router/ui';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BOTTOM_BAR_HEIGHT, BottomNav, SideNav } from '@/components/ui/AppNavBar';
import { BlurTargetArea, BlurTargetProvider } from '@/components/ui/BlurTarget';
import { NavInsetContext, useIsWide } from '@/components/ui/layout';
import { activeModules } from '@/modules/registry';

/**
 * Menú adaptable (research R2): un único navegador de pestañas cuya barra se dibuja
 * abajo (< 1024 px) o a la izquierda (≥ 1024 px). Las posiciones de los hijos se
 * mantienen estables para que al redimensionar no se desmonte la pantalla actual.
 */
export default function TabsLayout() {
  const wide = useIsWide();
  const insets = useSafeAreaInsets();
  const navInset = wide ? 0 : BOTTOM_BAR_HEIGHT + Math.max(insets.bottom, 10);

  return (
    <Tabs>
      <BlurTargetProvider>
        <NavInsetContext.Provider value={navInset}>
          <View style={[styles.root, { flexDirection: wide ? 'row' : 'column' }]}>
            {wide ? <SideNav /> : null}
            <BlurTargetArea>
              <TabSlot style={styles.slot} />
            </BlurTargetArea>
            {wide ? null : <BottomNav />}
          </View>
        </NavInsetContext.Provider>
      </BlurTargetProvider>
      <TabList style={styles.hidden}>
        {activeModules.map((m) => (
          <TabTrigger key={m.id} name={m.id} href={m.route ?? '/'} />
        ))}
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  slot: { flex: 1, height: '100%' },
  hidden: { display: 'none' },
});
