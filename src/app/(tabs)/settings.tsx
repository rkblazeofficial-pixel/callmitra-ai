import { router } from 'expo-router';
import { Alert, Switch, Text, View } from 'react-native';
import { Btn, Card, Chip, DemoBanner, H1, H2, Label, Muted, Screen } from '@/components/ui';
import { LANGUAGES, SPEEDS, STYLES } from '@/lib/data';
import { cloud } from '@/lib/cloud';
import { ModeBanner } from '@/components/ModeBanner';
import { maskPhone, useStore } from '@/lib/store';
import { C } from '@/lib/theme';

export default function Settings() {
  const { s, setPrefs, logOut, removeOptOut, resetAll } = useStore();
  const p = s.prefs;
  return (
    <Screen>
      <H1>Settings</H1>
      <Muted style={{ marginBottom: 14 }}>{s.user?.name} · {s.user?.email}</Muted>
      <ModeBanner />

      <Card>
        <H2 style={{ marginBottom: 10 }}>Language & voice</H2>
        <Label>Default language</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{LANGUAGES.map((l) => <Chip key={l.id} label={l.label} active={p.language === l.id} onPress={() => setPrefs({ language: l.id })} />)}</View>
        <Label>Voice</Label>
        <View style={{ flexDirection: 'row' }}>
          <Chip label="Female" icon="woman-outline" active={p.gender === 'female'} onPress={() => setPrefs({ gender: 'female' })} />
          <Chip label="Male" icon="man-outline" active={p.gender === 'male'} onPress={() => setPrefs({ gender: 'male' })} />
        </View>
        <Label>Style</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{STYLES.map((x) => <Chip key={x} label={x} active={p.style === x} onPress={() => setPrefs({ style: x })} />)}</View>
        <Label>Speaking speed</Label>
        <View style={{ flexDirection: 'row' }}>{SPEEDS.map((x) => <Chip key={x} label={x} active={p.speed === x} onPress={() => setPrefs({ speed: x })} />)}</View>
      </Card>

      <Card>
        <H2 style={{ marginBottom: 10 }}>Notifications</H2>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: C.text, flex: 1 }}>Call updates</Text>
          <Switch value={p.notifications} onValueChange={(v) => setPrefs({ notifications: v })} trackColor={{ true: C.primary }} />
        </View>
        <Muted style={{ marginTop: 6 }}>Push delivery starts once the cloud backend is live.</Muted>
      </Card>

      <Card>
        <H2 style={{ marginBottom: 6 }}>Consent & opt-outs</H2>
        <Muted>If someone says “don’t call me again”, their number is blocked from future calls. Removing a block should only be done if the person asked to be called again.</Muted>
        {s.optOuts.length === 0 ? <Muted style={{ marginTop: 8 }}>No opt-outs recorded.</Muted> : s.optOuts.map((o) => (
          <View key={o.phone} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <Text style={{ color: C.text }}>{maskPhone(o.phone)} · {new Date(o.at).toLocaleDateString()}</Text>
            <Text style={{ color: C.cyan, fontWeight: '600', padding: 8 }} onPress={() => Alert.alert('Allow calls again?', 'Only do this if the person asked for it.', [{ text: 'Cancel' }, { text: 'Allow', onPress: () => removeOptOut(o.phone) }])}>Unblock</Text>
          </View>
        ))}
      </Card>

      <Card>
        <H2 style={{ marginBottom: 6 }}>Privacy</H2>
        <Muted>Call audio is not recorded or stored. Your data is kept on this device in this version and is never shared. Live calls will respect DND/NCPR rules and permitted calling hours.</Muted>
      </Card>

      <Card>
        <H2 style={{ marginBottom: 6 }}>Help & support</H2>
        <Muted>CallMitra AI by Rash Production. Version 0.1.0 (demo build).</Muted>
      </Card>

      <View style={{ gap: 10 }}>
        <Btn title="Log out" variant="ghost" icon="log-out-outline" onPress={async () => { await cloud.signOut(); logOut(); router.replace('/'); }} />
        <Btn title="Delete all data on this device" variant="danger" onPress={() => Alert.alert('Delete everything?', 'This removes your account, contacts, drafts and history from this device.', [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await cloud.signOut(); resetAll(); router.replace('/'); } }])} />
      </View>
    </Screen>
  );
}
