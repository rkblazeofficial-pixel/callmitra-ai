import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, Switch, Text, View } from 'react-native';
import { Btn, Card, Chip, Empty, Field, H1, H2, Muted, Screen } from '@/components/ui';
import { Contact, maskPhone, useStore } from '@/lib/store';
import { C } from '@/lib/theme';

type Form = Omit<Contact, 'id'> & { id?: string };
const blank: Form = { name: '', phone: '', relation: '', group: 'Family', consent: false };

export default function ContactsScreen() {
  const { s, saveContact, deleteContact, importContacts, isOptedOut } = useStore();
  const [form, setForm] = useState<Form | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [group, setGroup] = useState('All');
  const groups = useMemo(() => ['All', ...Array.from(new Set(s.contacts.map((c) => c.group).filter(Boolean)))], [s.contacts]);
  const list = s.contacts.filter((c) => group === 'All' || c.group === group);

  const doImport = async () => {
    const perm = await Contacts.requestPermissionsAsync();
    if (perm.status !== 'granted') return Alert.alert('Permission needed', 'Allow contacts access to import. Nothing is uploaded.');
    const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name] });
    const items = data.flatMap((c) => (c.phoneNumbers?.[0]?.number && c.name ? [{ name: c.name, phone: c.phoneNumbers[0].number }] : []));
    const n = importContacts(items);
    Alert.alert('Import done', `${n} new contact${n === 1 ? '' : 's'} added. Imported contacts have no consent recorded yet.`);
  };

  const save = () => {
    const e = saveContact(form!);
    if (e) return setErr(e);
    setForm(null); setErr(null);
  };

  return (
    <Screen>
      <H1>Contacts</H1>
      <Muted style={{ marginBottom: 14 }}>Only call people who have agreed to receive your call.</Muted>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
        <Btn title="Add" icon="add" style={{ flex: 1 }} onPress={() => { setErr(null); setForm(blank); }} />
        <Btn title="Import" icon="download-outline" variant="ghost" style={{ flex: 1 }} onPress={doImport} />
      </View>
      {groups.length > 2 ? <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{groups.map((g) => <Chip key={g} label={g} active={g === group} onPress={() => setGroup(g)} />)}</View> : null}
      {list.length === 0 ? <Empty icon="people-outline" title="No contacts" body="Add someone you want to call, or import from your phone." />
        : list.map((c) => (
          <Card key={c.id} onPress={() => { setErr(null); setForm(c); }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <H2>{c.name}</H2>
              <Text style={{ color: C.muted }}>{c.group}</Text>
            </View>
            <Muted>{maskPhone(c.phone)}{c.relation ? ` · ${c.relation}` : ''}</Muted>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 6 }}>
              {isOptedOut(c.phone) ? (
                <><Ionicons name="ban" size={16} color={C.danger} /><Text style={{ color: C.danger }}>Opted out. Calls blocked</Text></>
              ) : c.consent ? (
                <><Ionicons name="shield-checkmark" size={16} color={C.success} /><Text style={{ color: C.success }}>Consent recorded</Text></>
              ) : (
                <><Ionicons name="alert-circle" size={16} color={C.warn} /><Text style={{ color: C.warn }}>No consent yet</Text></>
              )}
            </View>
          </Card>
        ))}

      <Modal visible={!!form} animationType="slide" transparent onRequestClose={() => setForm(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bg2, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 34 }}>
            <H2 style={{ marginBottom: 12 }}>{form?.id ? 'Edit contact' : 'New contact'}</H2>
            <Field label="Name" value={form?.name} onChangeText={(v) => setForm({ ...form!, name: v })} />
            <Field label="Phone" value={form?.phone} onChangeText={(v) => setForm({ ...form!, phone: v })} keyboardType="phone-pad" placeholder="+91XXXXXXXXXX" error={err} />
            <Field label="Relationship" value={form?.relation} onChangeText={(v) => setForm({ ...form!, relation: v })} placeholder="e.g. Cousin" />
            <Field label="Group" value={form?.group} onChangeText={(v) => setForm({ ...form!, group: v })} placeholder="Family, Friends…" />
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 12 }}>
              <Switch value={!!form?.consent} onValueChange={(v) => setForm({ ...form!, consent: v })} trackColor={{ true: C.primary }} />
              <Text style={{ color: C.text, flex: 1, lineHeight: 20 }}>This person has agreed to receive AI-assisted calls from me.</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {form?.id ? <Btn title="Delete" variant="danger" style={{ flex: 1 }} onPress={() => Alert.alert('Delete contact?', form.name, [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { deleteContact(form.id!); setForm(null); } }])} /> : null}
              <Btn title="Cancel" variant="ghost" style={{ flex: 1 }} onPress={() => setForm(null)} />
              <Btn title="Save" style={{ flex: 1 }} onPress={save} />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
