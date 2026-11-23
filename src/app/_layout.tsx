import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { C } from '@/lib/theme';
import { StoreProvider } from '@/lib/store';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  return (
    <StoreProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'fade' }}>
        <Stack.Screen name="create" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
        <Stack.Screen name="call/[id]" options={{ animation: 'fade', gestureEnabled: false }} />
      </Stack>
    </StoreProvider>
  );
}
