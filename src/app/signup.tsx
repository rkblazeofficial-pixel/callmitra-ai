import { router } from 'expo-router';
import { useState } from 'react';
import { Back, Btn, DemoBanner, Field, H1, Muted, Screen } from '@/components/ui';
import { cloud, cloudEnabled } from '@/lib/cloud';
import { useStore } from '@/lib/store';

export default function Signup() {
  const { signUp, setCloudUser } = useStore();
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    if (!cloudEnabled) {
      const e = signUp(name, email, pw);
      if (e) return setErr(e);
      return router.replace('/');
    }
    if (!name.trim()) return setErr('Please enter your name.');
    if (pw.length < 6) return setErr('Password must be at least 6 characters.');
    setBusy(true); setErr(null);
    try {
      const r = await cloud.signUp(email.trim(), pw, name.trim());
      if (r.status === 'confirm_email') return setInfo('We sent a confirmation link to your email. Open it, then come back and log in.');
      setCloudUser(name.trim(), email.trim());
      router.replace('/');
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Screen>
      <Back onPress={() => router.back()} />
      <H1 style={{ marginTop: 8 }}>Create your account</H1>
      <Muted style={{ marginBottom: 18 }}>It takes less than a minute.</Muted>
      {cloudEnabled ? null : <DemoBanner text="Accounts are stored on this device only in this early version. OTP and email verification need the cloud backend." />}
      <Field label="Your name" value={name} onChangeText={setName} placeholder="e.g. Kamal" />
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" />
      <Field label="Password" value={pw} onChangeText={setPw} secureTextEntry placeholder="At least 6 characters" error={err} />
      {info ? <Muted style={{ marginBottom: 12 }}>{info}</Muted> : null}
      <Btn title="Create account" onPress={submit} loading={busy} />
    </Screen>
  );
}
