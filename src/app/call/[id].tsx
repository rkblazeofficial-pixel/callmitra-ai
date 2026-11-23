import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Waveform } from '@/components/Waveform';
import { Btn, DemoBanner, H1, Muted, Screen } from '@/components/ui';
import { LANGUAGES } from '@/lib/data';
import { pendingCall } from '@/lib/pending';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';

// DEMO SIMULATION. No phone call is placed. The states below are scripted for the
// demo and are labelled as such; real states will come from the provider webhooks.
const STATES = [
  { label: 'Preparing call', ms: 1500, wave: false },
  { label: 'Connecting', ms: 1800, wave: false },
  { label: 'AI speaking', ms: 4500, wave: true },
  { label: 'Listening to recipient', ms: 3000, wave: false },
  { label: 'Processing response', ms: 1500, wave: false },
  { label: 'AI responding', ms: 3000, wave: true },
  { label: 'Listening to recipient', ms: 2500, wave: false },
  { label: 'AI speaking', ms: 2500, wave: true },
];

export default function CallScreen() {
  const { addCall, addOptOut } = useStore();
  const call = pendingCall;
  const [i, setI] = useState(0);
  const [secs, setSecs] = useState(0);
  const [done, setDone] = useState<null | 'completed' | 'ended'>(null);
  const saved = useRef(false);

  const finish = (kind: 'completed' | 'ended', outcome: string, optOut = false) => {
    if (saved.current || !call) return;
    saved.current = true;
    if (optOut) addOptOut(call.phone);
    addCall({ ...call, createdAt: new Date().toISOString(), durationSec: secs, status: kind === 'completed' ? 'demo_completed' : 'demo_cancelled', outcome });
    setDone(kind);
  };

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setSecs((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [done]);

  useEffect(() => {
    if (done || !call) return;
    const t = setTimeout(() => {
      if (i + 1 >= STATES.length) finish('completed', 'Demo simulation finished');
      else setI(i + 1);
    }, STATES[i].ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, done]);

  if (!call) {
    return (
      <Screen><H1>No call in progress</H1><Btn title="Back to home" onPress={() => router.replace('/(tabs)/home')} /></Screen>
    );
  }
  const st = STATES[i];
  const lang = LANGUAGES.find((l) => l.id === call.language)?.label;
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  return (
    <Screen scroll={false} style={{ justifyContent: 'space-between' }}>
      <View>
        <DemoBanner text="DEMO SIMULATION: no real phone call is being made. States below are scripted." />
        <View style={{ alignItems: 'center', marginTop: 20 }}>
          <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: C.card, borderWidth: 2, borderColor: C.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="person" size={44} color={C.cyan} />
          </View>
          <H1 style={{ marginTop: 14 }}>{call.recipient}</H1>
          <Muted>{call.voiceName} ({call.gender}) · {lang}</Muted>
          <Text style={{ color: C.cyan, fontSize: 18, fontWeight: '700', marginTop: 18 }}>
            {done === 'completed' ? 'Call completed (demo)' : done ? 'Call ended (demo)' : st.label}
          </Text>
          <Text style={{ color: C.text, fontSize: 32, fontWeight: '300', marginTop: 4 }}>{mm}:{ss}</Text>
        </View>
        <View style={{ marginTop: 28 }}><Waveform active={!done && st.wave} bars={27} height={80} /></View>
      </View>
      <View style={{ gap: 10 }}>
        {done ? (
          <Btn title="Back to home" onPress={() => router.replace('/(tabs)/home')} />
        ) : (
          <>
            <Btn title="Simulate “don’t call me again”" variant="ghost" onPress={() => finish('ended', 'Recipient opted out (demo). Number blocked', true)} />
            <Btn title="End call" variant="danger" icon="call" onPress={() => finish('ended', 'Ended by you (demo)')} />
          </>
        )}
      </View>
    </Screen>
  );
}
