import { DemoBanner } from '@/components/ui';
import { useCallMode } from '@/lib/cloud';

/** Shows the truth about whether calls are real. Renders nothing only when the server says live calling is on. */
export function ModeBanner() {
  const m = useCallMode();
  if (m === 'live' || m === 'checking') return null;
  if (m === 'server-demo') return <DemoBanner text="DEMO MODE: the server has live calling switched off, so no real calls are placed." />;
  return <DemoBanner />;
}
