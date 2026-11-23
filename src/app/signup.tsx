import { router } from 'expo-router';
import { useState } from 'react';
import { Back, Btn, DemoBanner, Field, H1, Muted, Screen } from '@/components/ui';
import { useStore } from '@/lib/store';

export default function Signup() {
  const { signUp } = useStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const submit = () => {
    const e = signUp(name, email, pw);
    if (e) return setErr(e);
    router.replace('/');
  };
  return (
    <Screen>
      <Back onPress={() => router.back()} />
      <H1 style={{ marginTop: 8 }}>Create your account</H1>
      <Muted style={{ marginBottom: 18 }}>It takes less than a minute.</Muted>
      <DemoBanner text="Accounts are stored on this device only in this early version. OTP and email verification need the cloud backend." />
      <Field label="Your name" value={name} onChangeText={setName} placeholder="e.g. Kamal" />
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" />
      <Field label="Password" value={pw} onChangeText={setPw} secureTextEntry placeholder="At least 6 characters" error={err} />
      <Btn title="Create account" onPress={submit} />
    </Screen>
  );
}
