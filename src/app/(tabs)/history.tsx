import { CallRow } from '@/components/CallRow';
import { Empty, H1, Muted, Screen } from '@/components/ui';
import { useStore } from '@/lib/store';

export default function History() {
  const { s } = useStore();
  return (
    <Screen>
      <H1>Call history</H1>
      <Muted style={{ marginBottom: 14 }}>Tap a call to see the script that was used.</Muted>
      {s.calls.length === 0 ? <Empty icon="time-outline" title="Nothing here yet" body="Calls you run will appear here with their status and outcome." />
        : s.calls.map((c) => <CallRow key={c.id} call={c} expandable />)}
    </Screen>
  );
}
