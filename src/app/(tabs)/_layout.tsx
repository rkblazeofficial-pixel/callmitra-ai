import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';

export default function TabsLayout() {
  const { s } = useStore();
  const i = useSafeAreaInsets();
  if (!s.user || !s.loggedIn) return <Redirect href="/" />;
  const icon = (n: keyof typeof Ionicons.glyphMap, on: keyof typeof Ionicons.glyphMap) =>
    ({ color, focused }: { color: any; focused: boolean }) => <Ionicons name={focused ? on : n} size={24} color={color} />;
  return (
    <Tabs screenOptions={{
      headerShown: false, tabBarActiveTintColor: C.cyan, tabBarInactiveTintColor: C.muted,
      tabBarStyle: { backgroundColor: C.bg2, borderTopColor: C.border, height: 58 + i.bottom, paddingBottom: i.bottom + 4, paddingTop: 6 },
      tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      sceneStyle: { backgroundColor: C.bg },
    }}>
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: icon('time-outline', 'time') }} />
      <Tabs.Screen name="contacts" options={{ title: 'Contacts', tabBarIcon: icon('people-outline', 'people') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('settings-outline', 'settings') }} />
    </Tabs>
  );
}
