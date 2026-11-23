import { router } from 'expo-router';
import { useState } from 'react';
import { Back, Btn, DemoBanner, Field, H1, Muted, Screen } from '@/components/ui';
import { useStore } from '@/lib/store';

export default function Forgot() {
  const { resetPassword } = useStore();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const submit = () => {
    const e = resetPassword(email, pw);
    if (e) return setErr(e);
    setErr(null); setOk(true);
  };
  return (
    <Screen>
      <Back onPress={() => router.back()} />
      <H1 style={{ marginTop: 8 }}>Reset password</H1>
      <DemoBanner text="No email can be sent yet. For now you can set a new password for the account saved on this device." />
      <Field label="Account email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Field label="New password" value={pw} onChangeText={setPw} secureTextEntry error={err} />
      {ok ? <Muted style={{ marginBottom: 12 }}>Password updated. You can log in now.</Muted> : null}
      {ok ? <Btn title="Back to login" onPress={() => router.replace('/login')} /> : <Btn title="Set new password" onPress={submit} />}
    </Screen>
  );
}
