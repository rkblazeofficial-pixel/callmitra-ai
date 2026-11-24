import { Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { cloud, cloudEnabled } from '@/lib/cloud';
import { View } from 'react-native';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';

// Gate: decides where the app opens. The two intros play on first launch only.
export default function Gate() {
  const { ready, s, logOut } = useStore();
  const [sessionOk, setSessionOk] = useState(!cloudEnabled);
  useEffect(() => {
    if (!ready || !cloudEnabled) return;
    cloud.hasSession().then((ok) => { if (!ok) logOut(); setSessionOk(true); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => {}); }, [ready]);
  if (!ready || !sessionOk) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  if (!s.introSeen) return <Redirect href="/intro" />;
  if (!s.user || !s.loggedIn) return <Redirect href="/welcome" />;
  if (!s.user.profileDone) return <Redirect href="/profile-setup" />;
  return <Redirect href="/(tabs)/home" />;
}
