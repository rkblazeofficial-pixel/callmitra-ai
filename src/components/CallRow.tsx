import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Card } from '@/components/ui';
import { LANGUAGES, OCCASIONS } from '@/lib/data';
import { CallRecord, maskPhone } from '@/lib/store';
import { C } from '@/lib/theme';

export function CallRow({ call, expandable }: { call: CallRecord; expandable?: boolean }) {
  const [open, setOpen] = useState(false);
  const occ = OCCASIONS.find((o) => o.id === call.occasion)?.label ?? call.occasion;
  const lang = LANGUAGES.find((l) => l.id === call.language)?.label ?? call.language;
  const ok = call.status === 'demo_completed' || call.status === 'completed';
  const d = new Date(call.createdAt);
  const dur = `${Math.floor(call.durationSec / 60)}m ${call.durationSec % 60}s`;
  return (
    <Card onPress={expandable ? () => setOpen((o) => !o) : undefined}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: C.text, fontSize: 17, fontWeight: '700', flex: 1 }}>{call.recipient}</Text>
        {call.status.startsWith('demo') ? (
          <View style={{ backgroundColor: '#2A2410', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ color: C.warn, fontSize: 12, fontWeight: '700' }}>DEMO</Text>
          </View>
        ) : null}
      </View>
      <Text style={{ color: C.muted, marginTop: 4 }}>{maskPhone(call.phone)} · {occ}</Text>
      <Text style={{ color: C.muted, marginTop: 2 }}>
        {d.toLocaleDateString()} {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {dur} · {call.voiceName} ({call.gender}) · {lang}
      </Text>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 6 }}>
        <Ionicons name={ok ? 'checkmark-circle' : 'close-circle'} size={16} color={ok ? C.success : C.danger} />
        <Text style={{ color: C.text, fontSize: 14 }}>{call.outcome}</Text>
      </View>
      {open ? <Text style={{ color: C.muted, marginTop: 10, lineHeight: 21 }}>{call.script}</Text> : null}
    </Card>
  );
}
