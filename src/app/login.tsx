import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Back, Btn, DemoBanner, Field, H1, Muted, Screen } from '@/components/ui';
import { cloud, cloudEnabled } from '@/lib/cloud';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';

export default function Login() {
  const { logIn, setCloudUser, s } = useStore();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(s.user?.email ?? '');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    if (!cloudEnabled) {
      const e = logIn(email, pw);
      if (e) return setErr(e);
      return router.replace('/');
    }
    setBusy(true); setErr(null);
    try {
      const r = await cloud.signIn(email.trim(), pw);
      setCloudUser(r.name || r.email.split('@')[0], r.email);
      router.replace('/');
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Screen>
      <Back onPress={() => router.back()} />
      <H1 style={{ marginTop: 8 }}>Welcome back</H1>
      <Muted style={{ marginBottom: 18 }}>Log in to continue.</Muted>
      {cloudEnabled ? null : <DemoBanner text="Accounts are stored on this device only in this early version. Cloud accounts (Supabase) come with the backend." />}
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" />
      <Field label="Password" value={pw} onChangeText={setPw} secureTextEntry placeholder="Your password" error={err} />
      <Btn title="Log in" onPress={submit} loading={busy} />
      <Pressable onPress={() => router.push('/forgot')} style={{ padding: 16, alignItems: 'center' }}>
        <Text style={{ color: C.cyan, fontWeight: '600' }}>Forgot password?</Text>
      </Pressable>
      <View style={{ height: 8 }} />
    </Screen>
  );
}
