import { router } from 'expo-router';
import { useState } from 'react';
import { Back, Btn, DemoBanner, Field, H1, Muted, Screen } from '@/components/ui';
import { cloud, cloudEnabled } from '@/lib/cloud';
import { useStore } from '@/lib/store';

export default function Forgot() {
  const { resetPassword } = useStore();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (cloudEnabled) {
      setBusy(true); setErr(null);
      try { await cloud.recover(email.trim()); setOk(true); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
      return;
    }
    const e = resetPassword(email, pw);
    if (e) return setErr(e);
    setErr(null); setOk(true);
  };
  return (
    <Screen>
      <Back onPress={() => router.back()} />
      <H1 style={{ marginTop: 8 }}>Reset password</H1>
      {cloudEnabled ? null : <DemoBanner text="No email can be sent yet. For now you can set a new password for the account saved on this device." />}
      <Field label="Account email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      {cloudEnabled ? null : <Field label="New password" value={pw} onChangeText={setPw} secureTextEntry error={err} />}
      {cloudEnabled && err ? <Muted style={{ marginBottom: 12, color: '#FF5C7A' }}>{err}</Muted> : null}
      {ok ? <Muted style={{ marginBottom: 12 }}>{cloudEnabled ? 'If an account exists for this email, a reset link has been sent.' : 'Password updated. You can log in now.'}</Muted> : null}
      {ok ? <Btn title="Back to login" onPress={() => router.replace('/login')} /> : <Btn title={cloudEnabled ? 'Send reset link' : 'Set new password'} onPress={submit} loading={busy} />}
    </Screen>
  );
}
