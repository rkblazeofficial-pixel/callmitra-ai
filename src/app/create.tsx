import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { Back, Btn, Card, Chip, DemoBanner, Field, H1, H2, Label, Muted, Screen } from '@/components/ui';
import { Gender, LANGUAGES, LanguageId, OCCASIONS, OccasionId, SPEEDS, STYLES, voicesFor } from '@/lib/data';
import { generate, Generated } from '@/lib/generator';
import { CloudError, cloud, cloudEnabled, newIdempotencyKey, useCallMode } from '@/lib/cloud';
import { saveLiveCall, setPendingCall } from '@/lib/pending';
import { isValidPhone, maskPhone, useStore } from '@/lib/store';
import { C } from '@/lib/theme';

const STEPS = ['Occasion', 'Recipient', 'Your message', 'Script', 'Voice', 'Preview', 'Confirm'];

export default function Create() {
  const params = useLocalSearchParams<{ occasion?: string; text?: string }>();
  const { s, saveDraft, isOptedOut, addOptOut } = useStore();
  const mode = useCallMode();
  const [busy, setBusy] = useState(false);
  const keyRef = useRef(newIdempotencyKey());
  const [step, setStep] = useState(params.occasion ? 1 : 0);
  const [occasion, setOccasion] = useState<OccasionId>((params.occasion as OccasionId) || 'birthday');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relation, setRelation] = useState('');
  const [notes, setNotes] = useState('');
  const [language, setLanguage] = useState<LanguageId>(s.prefs.language);
  const [text, setText] = useState(params.text ?? '');
  const [gen, setGen] = useState<Generated | null>(null);
  const [script, setScript] = useState('');
  const [gender, setGender] = useState<Gender>(s.prefs.gender);
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [style, setStyle] = useState(s.prefs.style);
  const [speed, setSpeed] = useState(s.prefs.speed);
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const voices = useMemo(() => voicesFor(language, gender), [language, gender]);
  const voice = voices.find((v) => v.id === voiceId) ?? voices[0];
  const occLabel = OCCASIONS.find((o) => o.id === occasion)!.label;
  const langLabel = LANGUAGES.find((l) => l.id === language)!.label;

  const runGenerate = () => {
    const g = generate({ occasion, hostName: s.user?.name ?? '', recipientName: name, relation, language, text, notes });
    setGen(g); setScript(g.script); setSaved(false); setStep(3);
  };
  const next = () => { setErr(null); setStep((x) => x + 1); };
  const checkRecipient = () => {
    if (!name.trim()) return setErr('Please enter the recipient’s name.');
    if (!isValidPhone(phone)) return setErr('Enter a valid phone number (10–13 digits).');
    if (isOptedOut(phone)) return setErr('This person has asked not to be called. The number is blocked.');
    next();
  };
  const pickContact = (id: string) => {
    const c = s.contacts.find((x) => x.id === id)!;
    setName(c.name); setPhone(c.phone); setRelation(c.relation); setConsent(c.consent);
  };
  const SPEED: Record<string, number> = { Slow: 0.9, Normal: 1.0, Fast: 1.15 };
  const start = async () => {
    if (busy) return;
    if (!consent) return setErr('Please confirm the recipient has agreed to receive this call.');
    if (isOptedOut(phone)) return setErr('This number is blocked (opted out).');
    const base = { recipient: name.trim(), phone, occasion, language, voiceName: voice?.name ?? 'Default', gender, script };
    if (!cloudEnabled) { setPendingCall(base); return router.replace('/call/demo'); }
    setBusy(true); setErr(null);
    try {
      const r = await cloud.startCall({
        recipientName: name.trim(), phone, relation: relation || undefined, occasion: occLabel, occasionId: occasion, script,
        language: LANGUAGES.find((l) => l.id === language)!.code, languageLabel: langLabel, voice: voice?.id ?? '', voiceSpeed: SPEED[speed],
        hostName: s.user?.name ?? '', details: { date: gen?.facts.date, time: gen?.facts.time, venue: gen?.facts.venue }, qa: gen?.qa ?? [],
        consentConfirmed: consent, idempotencyKey: keyRef.current,
      });
      keyRef.current = newIdempotencyKey();
      setPendingCall(base);
      if (r.mode === 'demo') return router.replace('/call/demo'); // the server says no real call was placed
      saveLiveCall(r.callId, base);
      router.replace({ pathname: '/call/[id]', params: { id: r.callId } });
    } catch (e) {
      const ce = e as CloudError;
      // Keep the same key only if no response arrived (the call may exist): a retry then cannot dial twice.
      if (!ce.isNetwork) keyRef.current = newIdempotencyKey();
      if (ce.code === 'opted_out') addOptOut(phone);
      setErr(ce.isNetwork ? `${ce.message} If a call was already started it will not be repeated.` : ce.message);
    } finally { setBusy(false); }
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Back onPress={() => (step === 0 || (step === 1 && params.occasion) ? router.back() : setStep(step - 1))} />
        <Pressable onPress={() => router.back()} style={{ padding: 10 }} accessibilityLabel="Close"><Ionicons name="close" size={26} color={C.muted} /></Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: 4, marginVertical: 8 }}>
        {STEPS.map((_, i) => <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? C.cyan : C.border }} />)}
      </View>
      <Muted>Step {step + 1} of {STEPS.length}</Muted>
      <H1 style={{ marginBottom: 14 }}>{STEPS[step]}</H1>

      {step === 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {OCCASIONS.map((o) => <Chip key={o.id} label={o.label} icon={o.icon as any} active={occasion === o.id} onPress={() => setOccasion(o.id)} />)}
          <View style={{ width: '100%', marginTop: 12 }}><Btn title="Continue" onPress={next} /></View>
        </View>
      )}

      {step === 1 && (
        <>
          {s.contacts.length > 0 ? (
            <>
              <Label>Pick a saved contact</Label>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
                {s.contacts.slice(0, 12).map((c) => <Chip key={c.id} label={c.name} onPress={() => pickContact(c.id)} />)}
              </View>
            </>
          ) : null}
          <Field label="Recipient name" value={name} onChangeText={setName} />
          <Field label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+91XXXXXXXXXX" />
          <Field label="Relationship" value={relation} onChangeText={setRelation} placeholder="e.g. Mama ji, friend" />
          <Label>Call language</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
            {LANGUAGES.map((l) => <Chip key={l.id} label={l.label} active={language === l.id} onPress={() => { setLanguage(l.id); setVoiceId(null); }} />)}
          </View>
          <Field label="Personal notes (optional)" value={notes} onChangeText={setNotes} multiline placeholder="Anything the AI should keep in mind" error={err} />
          <Btn title="Continue" onPress={checkRecipient} />
        </>
      )}

      {step === 2 && (
        <>
          <Muted style={{ marginBottom: 10 }}>Explain in your own words what you want to say to {name || 'them'}. Include date, time and venue if it’s an invitation.</Muted>
          <Field value={text} onChangeText={setText} multiline style={{ minHeight: 160 }}
            placeholder="e.g. Sunday 6 PM meri beti ka birthday hai, ghar par. Sabko pyaar se bulana hai." error={err} />
          <Btn title="Generate script" icon="sparkles-outline" onPress={() => (text.trim().length < 5 ? setErr('Please write a few words first.') : runGenerate())} />
        </>
      )}

      {step === 3 && gen && (
        <>
          <DemoBanner text="DEMO generator: it arranges only what you wrote. It never invents facts. The live AI replaces it once the backend is connected." />
          {gen.notice ? <Muted style={{ marginBottom: 10 }}>{gen.notice}</Muted> : null}
          {gen.missing.length > 0 ? (
            <Card style={{ borderColor: C.warn }}>
              <Text style={{ color: C.warn, fontWeight: '700', marginBottom: 4 }}>Details still missing</Text>
              {gen.missing.map((m) => <Text key={m} style={{ color: C.text, lineHeight: 22 }}>• {m}</Text>)}
              <Muted style={{ marginTop: 6 }}>Go back and add them, or edit the script below. The AI will say “I don’t have that information” if asked.</Muted>
            </Card>
          ) : null}
          <Label>Script (you can edit it)</Label>
          <Field value={script} onChangeText={setScript} multiline style={{ minHeight: 260, lineHeight: 22 }} />
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
            <Btn title="Regenerate" variant="ghost" icon="refresh" style={{ flex: 1 }} onPress={runGenerate} />
            <Btn title={saved ? 'Saved' : 'Save draft'} variant="ghost" icon="bookmark-outline" style={{ flex: 1 }}
              onPress={() => { saveDraft({ occasion, text, script }); setSaved(true); }} />
          </View>
          <Btn title="Looks good" disabled={script.trim().length < 20} onPress={next} />
        </>
      )}

      {step === 4 && (
        <>
          <Label>Voice</Label>
          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            <Chip label="Female" icon="woman-outline" active={gender === 'female'} onPress={() => { setGender('female'); setVoiceId(null); }} />
            <Chip label="Male" icon="man-outline" active={gender === 'male'} onPress={() => { setGender('male'); setVoiceId(null); }} />
          </View>
          {voices.length === 0 ? <Card><Muted>No {gender} voice is available for {langLabel} yet. Try the other voice type or another language.</Muted></Card>
            : voices.map((v) => (
              <Card key={v.id} onPress={() => setVoiceId(v.id)} style={voice?.id === v.id ? { borderColor: C.cyan } : undefined}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Ionicons name={voice?.id === v.id ? 'radio-button-on' : 'radio-button-off'} size={22} color={C.cyan} />
                  <View style={{ flex: 1 }}>
                    <H2>{v.name}</H2>
                    <Muted>{gender === 'female' ? 'Female' : 'Male'} · {langLabel}</Muted>
                  </View>
                </View>
              </Card>
            ))}
          <Muted style={{ marginBottom: 12 }}>Voice preview is not available yet. It plays real audio once the backend is connected to the voice provider.</Muted>
          <Label>Style</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{STYLES.map((x) => <Chip key={x} label={x} active={style === x} onPress={() => setStyle(x)} />)}</View>
          <Label>Speaking speed</Label>
          <View style={{ flexDirection: 'row', marginBottom: 10 }}>{SPEEDS.map((x) => <Chip key={x} label={x} active={speed === x} onPress={() => setSpeed(x)} />)}</View>
          <Btn title="Continue" disabled={!voice} onPress={next} />
        </>
      )}

      {step === 5 && gen && (
        <>
          <Muted style={{ marginBottom: 10 }}>This is how the conversation is planned. In a live call the AI answers any question using only the facts you provided.</Muted>
          <Bubble who="AI · opening and message" text={script} />
          {gen.qa.map((x) => (
            <View key={x.q}>
              <Bubble who={`${name || 'Recipient'} may ask`} text={x.q} alt />
              <Bubble who="AI answers" text={x.a} />
            </View>
          ))}
          <Bubble who="AI · ending" text={gen.closing} />
          <Btn title="Continue" onPress={next} style={{ marginTop: 6 }} />
        </>
      )}

      {step === 6 && (
        <>
          {mode === 'live'
            ? <Card style={{ borderColor: C.warn }}><Text style={{ color: C.warn, fontWeight: '700' }}>This places a REAL phone call.</Text><Muted>The recipient will get an AI-voiced call right away. It cannot be hung up from here once it starts.</Muted></Card>
            : <DemoBanner text="DEMO: confirming runs a clearly labelled simulation. No phone call is made and nothing is billed." />}
          <Card>
            <Row k="To" v={`${name} · ${maskPhone(phone)}`} />
            <Row k="Occasion" v={occLabel} />
            <Row k="Language" v={langLabel} />
            <Row k="Voice" v={`${voice?.name} (${gender}) · ${style} · ${speed}`} />
          </Card>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 14 }}>
            <Switch value={consent} onValueChange={setConsent} trackColor={{ true: C.primary }} />
            <Text style={{ color: C.text, flex: 1, lineHeight: 21 }}>{name} has agreed to receive this AI-assisted call, and it is a personal, non-promotional message.</Text>
          </View>
          {err ? <Text style={{ color: C.danger, marginBottom: 10 }}>{err}</Text> : null}
          <Btn title={mode === 'live' ? 'Place real call now' : 'Run demo call'} icon="play" onPress={start} loading={busy} disabled={mode === 'checking'} />
          <Btn title="Schedule (needs cloud backend)" variant="ghost" disabled style={{ marginTop: 10 }} />
        </>
      )}
    </Screen>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, gap: 12 }}>
    <Text style={{ color: C.muted }}>{k}</Text>
    <Text style={{ color: C.text, fontWeight: '600', flex: 1, textAlign: 'right' }}>{v}</Text>
  </View>
);

const Bubble = ({ who, text, alt }: { who: string; text: string; alt?: boolean }) => (
  <View style={{ alignSelf: alt ? 'flex-end' : 'flex-start', maxWidth: '92%', backgroundColor: alt ? C.cardAlt : C.card, borderRadius: 16, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: C.border }}>
    <Text style={{ color: C.cyan, fontSize: 12, fontWeight: '700', marginBottom: 4 }}>{who}</Text>
    <Text style={{ color: C.text, lineHeight: 22 }}>{text}</Text>
  </View>
);
