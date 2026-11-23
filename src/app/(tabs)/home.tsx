import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Btn, Card, Chip, DemoBanner, Empty, Field, H1, H2, Muted, Screen } from '@/components/ui';
import { OCCASIONS } from '@/lib/data';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import { CallRow } from '@/components/CallRow';

export default function Home() {
  const { s } = useStore();
  const [idea, setIdea] = useState('');
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const total = s.calls.length;
  const mins = Math.round(s.calls.reduce((a, c) => a + c.durationSec, 0) / 60);
  const start = (occasion?: string) => router.push({ pathname: '/create', params: { occasion: occasion ?? '', text: idea } });
  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Muted>{greet},</Muted>
          <H1>{s.user?.name} 👋</H1>
        </View>
        <Image source={require('../../../assets/images/callmitra-icon.png')} style={{ width: 52, height: 52 }} resizeMode="contain" />
      </View>
      <View style={{ height: 14 }} />
      <DemoBanner />
      <Btn title="Create New AI Call" icon="call-outline" onPress={() => start()} />

      <Card style={{ marginTop: 16 }}>
        <H2 style={{ marginBottom: 4 }}>AI Message Generator</H2>
        <Muted style={{ marginBottom: 10 }}>Tell us in your own words what to say.</Muted>
        <Field value={idea} onChangeText={setIdea} multiline placeholder="e.g. Sunday 6 PM meri beti ka birthday hai, ghar par. Sabko pyaar se bulana hai." />
        <Btn title="Generate script" icon="sparkles-outline" variant="ghost" disabled={idea.trim().length < 5} onPress={() => start()} />
      </Card>

      <H2 style={{ marginTop: 8, marginBottom: 10 }}>Occasions</H2>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20 }}>
        {OCCASIONS.map((o) => <Chip key={o.id} label={o.label} icon={o.icon as any} onPress={() => start(o.id)} />)}
      </ScrollView>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <Stat label="Demo calls" value={String(total)} />
        <Stat label="Minutes" value={String(mins)} />
        <Stat label="Contacts" value={String(s.contacts.length)} />
      </View>
      <Card style={{ marginTop: 6 }}>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <Ionicons name="wallet-outline" size={22} color={C.cyan} />
          <Muted style={{ flex: 1 }}>Credits: none used. Demo mode is free. Live call credits will appear here once calling is enabled.</Muted>
        </View>
      </Card>

      <H2 style={{ marginTop: 8, marginBottom: 10 }}>Scheduled calls</H2>
      <Card><Muted>Scheduling needs the cloud backend, so nothing can be scheduled yet.</Muted></Card>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 10 }}>
        <H2>Recent calls</H2>
        {total > 3 ? <Pressable onPress={() => router.push('/history')}><Text style={{ color: C.cyan, fontWeight: '600' }}>See all</Text></Pressable> : null}
      </View>
      {total === 0 ? <Empty icon="call-outline" title="No calls yet" body="Your demo calls will show up here." />
        : s.calls.slice(0, 3).map((c) => <CallRow key={c.id} call={c} />)}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.border }}>
      <Text style={{ color: C.text, fontSize: 24, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: C.muted, fontSize: 13 }}>{label}</Text>
    </View>
  );
}
