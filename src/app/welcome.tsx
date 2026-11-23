import { router } from 'expo-router';
import { Image, Text, View } from 'react-native';
import { Btn, H1, Muted, Screen } from '@/components/ui';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';

export default function Welcome() {
  const { s } = useStore();
  return (
    <Screen scroll={false} style={{ justifyContent: 'space-between' }}>
      <View style={{ alignItems: 'center', marginTop: 16 }}>
        <Image source={require('../../assets/images/callmitra-logo.png')} resizeMode="contain" style={{ width: 280, height: 240 }} />
        <H1 style={{ textAlign: 'center', marginTop: 8 }}>Call anyone, with a personal touch.</H1>
        <Muted style={{ textAlign: 'center', marginTop: 10 }}>
          Describe what you want to say. CallMitra writes the script, picks a voice, and talks with your guest like a real conversation.
        </Muted>
      </View>
      <View style={{ gap: 12 }}>
        {s.user ? <Btn title={`Log in as ${s.user.name}`} onPress={() => router.push('/login')} /> : <Btn title="Create account" onPress={() => router.push('/signup')} />}
        {s.user ? <Btn title="Use a different account" variant="ghost" onPress={() => router.push('/signup')} /> : <Btn title="I already have an account" variant="ghost" onPress={() => router.push('/login')} />}
        <Text style={{ color: C.muted, textAlign: 'center', fontSize: 12, marginTop: 4 }}>By Rash Production</Text>
      </View>
    </Screen>
  );
}
