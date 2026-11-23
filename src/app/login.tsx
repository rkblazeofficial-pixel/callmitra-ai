import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Back, Btn, DemoBanner, Field, H1, Muted, Screen } from '@/components/ui';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';

export default function Login() {
  const { logIn, s } = useStore();
  const [email, setEmail] = useState(s.user?.email ?? '');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const submit = () => {
    const e = logIn(email, pw);
    if (e) return setErr(e);
    router.replace('/');
  };
  return (
    <Screen>
      <Back onPress={() => router.back()} />
      <H1 style={{ marginTop: 8 }}>Welcome back</H1>
      <Muted style={{ marginBottom: 18 }}>Log in to continue.</Muted>
      <DemoBanner text="Accounts are stored on this device only in this early version. Cloud accounts (Supabase) come with the backend." />
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" />
      <Field label="Password" value={pw} onChangeText={setPw} secureTextEntry placeholder="Your password" error={err} />
      <Btn title="Log in" onPress={submit} />
      <Pressable onPress={() => router.push('/forgot')} style={{ padding: 16, alignItems: 'center' }}>
        <Text style={{ color: C.cyan, fontWeight: '600' }}>Forgot password?</Text>
      </Pressable>
      <View style={{ height: 8 }} />
    </Screen>
  );
}
