import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Btn, Chip, Field, H1, Label, Muted, Screen } from '@/components/ui';
import { LANGUAGES } from '@/lib/data';
import { useStore } from '@/lib/store';

export default function ProfileSetup() {
  const { s, updateUser, setPrefs } = useStore();
  const [name, setName] = useState(s.user?.name ?? '');
  const [phone, setPhone] = useState(s.user?.phone ?? '');
  const [lang, setLang] = useState(s.prefs.language);
  const [gender, setGender] = useState(s.prefs.gender);
  const submit = () => {
    updateUser({ name: name.trim() || s.user?.name, phone, profileDone: true });
    setPrefs({ language: lang, gender });
    router.replace('/');
  };
  return (
    <Screen>
      <H1 style={{ marginTop: 8 }}>Set up your profile</H1>
      <Muted style={{ marginBottom: 18 }}>These become your defaults. You can change them any time.</Muted>
      <Field label="Name callers will hear (who the call is from)" value={name} onChangeText={setName} />
      <Field label="Your phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Label>Preferred language</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
        {LANGUAGES.map((l) => <Chip key={l.id} label={l.label} active={lang === l.id} onPress={() => setLang(l.id)} />)}
      </View>
      <Label>Preferred AI voice</Label>
      <View style={{ flexDirection: 'row', marginBottom: 18 }}>
        <Chip label="Female" icon="woman-outline" active={gender === 'female'} onPress={() => setGender('female')} />
        <Chip label="Male" icon="man-outline" active={gender === 'male'} onPress={() => setGender('male')} />
      </View>
      <Btn title="Continue" onPress={submit} />
    </Screen>
  );
}
