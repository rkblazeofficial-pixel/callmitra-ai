import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Waveform } from '@/components/Waveform';
import { Btn, Card, DemoBanner, H1, Muted, Screen } from '@/components/ui';
import { cloud } from '@/lib/cloud';
import { LANGUAGES } from '@/lib/data';
import { clearLiveCall, loadLiveCall, Pending, pendingCall } from '@/lib/pending';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';

export default function CallScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return id === 'demo' ? <DemoCall /> : <LiveCall id={id} />;
}

// ---------------------------------------------------------------------------
// LIVE: every state shown here comes from the backend/provider. Nothing is scripted.
// ThunderPhone's REST API reports queued / in progress / completed / failed. It does not
// report "AI speaking" vs "listening", so this screen does not pretend to.
// ---------------------------------------------------------------------------
const END_REASONS: Record<string, string> = {
  user_hangup: 'Recipient hung up', ai_hangup: 'Call ended by the assistant', voicemail_hangup: 'Voicemail answered (no message left)',
  outbound_no_answer: 'No answer', max_duration: 'Reached the maximum call length', ai_transfer: 'Transferred',
  concurrent_call_limit_reached: 'Too many calls in progress', contact_opted_out: 'Number has opted out',
  insufficient_balance: 'Calling balance is empty', managed_number_outbound_pending: 'Outbound calling is not approved yet',
};
const reason = (r: string | null) => (r ? END_REASONS[r] ?? r.replace(/_/g, ' ') : 'No reason reported');

function LiveCall({ id }: { id: string }) {
  const { addCall, addOptOut } = useStore();
  const [info, setInfo] = useState<Pending | null>(pendingCall);
  const [state, setState] = useState<{ status: string; endReason: string | null; durationSeconds: number | null } | null>(null);
  const [fails, setFails] = useState(0);
  const [fatal, setFatal] = useState<string | null>(null);
  const [secs, setSecs] = useState(0);
  const saved = useRef(false);
  const final = state?.status === 'completed' || state?.status === 'failed';

  useEffect(() => { if (!info) loadLiveCall(id).then((c) => c && setInfo(c)); }, [id, info]);
  useEffect(() => { if (final) return; const t = setInterval(() => setSecs((x) => x + 1), 1000); return () => clearInterval(t); }, [final]);

  useEffect(() => {
    if (final || fatal) return;
    let alive = true; let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const r = await cloud.getCall(id);
        if (!alive) return;
        setState({ status: r.status, endReason: r.endReason, durationSeconds: r.durationSeconds }); setFails(0);
        if (r.status === 'completed' || r.status === 'failed') return;
      } catch (e: any) {
        if (!alive) return;
        if (e.status === 404 || e.code === 'no_session') return setFatal(e.status === 404 ? 'This call was not found.' : 'Please log in again to see this call.');
        setFails((n) => n + 1);
      }
      timer = setTimeout(tick, 3000);
    };
    tick();
    return () => { alive = false; clearTimeout(timer); };
  }, [id, final, fatal]);

  useEffect(() => {
    if (!final || saved.current || !state) return;
    saved.current = true;
    const ok = state.status === 'completed';
    if (info) addCall({ ...info, createdAt: new Date().toISOString(), durationSec: state.durationSeconds ?? secs, status: ok ? 'completed' : 'failed', outcome: reason(state.endReason) });
    if (state.endReason === 'contact_opted_out' && info) addOptOut(info.phone);
    clearLiveCall(id);
  }, [final, state, info, id, secs, addCall, addOptOut]);

  const label = fatal ? 'Unavailable' : !state ? 'Connecting to server…' : state.status === 'queued' ? 'Waiting to dial' : state.status === 'in_progress' ? 'Call in progress'
    : state.status === 'completed' ? 'Call completed' : 'Call failed';
  const shown = state?.durationSeconds ?? secs;
  const mm = String(Math.floor(shown / 60)).padStart(2, '0'); const ss = String(shown % 60).padStart(2, '0');
  const lang = info ? LANGUAGES.find((l) => l.id === info.language)?.label : '';
  return (
    <Screen scroll={false} style={{ justifyContent: 'space-between' }}>
      <View style={{ alignItems: 'center', marginTop: 24 }}>
        <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: C.card, borderWidth: 2, borderColor: final ? (state?.status === 'completed' ? C.success : C.danger) : C.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={final ? (state?.status === 'completed' ? 'checkmark' : 'close') : 'call'} size={44} color={C.cyan} />
        </View>
        <H1 style={{ marginTop: 14 }}>{info?.recipient ?? 'Call'}</H1>
        {info ? <Muted>{info.voiceName} ({info.gender}) · {lang}</Muted> : null}
        <Text style={{ color: C.cyan, fontSize: 18, fontWeight: '700', marginTop: 18 }}>{label}</Text>
        <Text style={{ color: C.text, fontSize: 32, fontWeight: '300', marginTop: 4 }}>{mm}:{ss}</Text>
        {final && state ? <Muted style={{ marginTop: 8 }}>{reason(state.endReason)}</Muted> : null}
        {fatal ? <Muted style={{ marginTop: 8 }}>{fatal}</Muted> : null}
        {fails >= 3 && !final ? <Muted style={{ marginTop: 8, color: C.warn }}>Lost contact with the server. Retrying… The call itself is not affected.</Muted> : null}
      </View>
      <View style={{ gap: 12 }}>
        {!final && !fatal ? (
          <Card><Muted>This is a real call. It runs on our servers, ends by itself, and keeps going even if you close the app. Detailed speaking and listening states are not available from the phone provider.</Muted></Card>
        ) : null}
        <Btn title={final || fatal ? 'Back to home' : 'Close (call keeps running)'} onPress={() => router.replace('/(tabs)/home')} />
      </View>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// DEMO SIMULATION. No phone call is placed. The states below are scripted for the
// demo and are labelled as such.
// ---------------------------------------------------------------------------
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

function DemoCall() {
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
