import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { API_URL, cloudEnabled, SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import { createCloud } from './cloud-client';

export { CloudError } from './cloud-client';
export { cloudEnabled };

export const cloud = createCloud(
  { apiUrl: API_URL, supabaseUrl: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY },
  (...a) => fetch(...a),
  { get: (k) => AsyncStorage.getItem(k), set: (k, v) => AsyncStorage.setItem(k, v), remove: (k) => AsyncStorage.removeItem(k) },
);

export const newIdempotencyKey = () =>
  'cm-' + Array.from({ length: 24 }, () => Math.floor(Math.random() * 36).toString(36)).join('');

/** What the app can honestly claim about calls right now. */
export type CallMode = 'local-demo' | 'server-demo' | 'live' | 'checking';
export function useCallMode(): CallMode {
  const [m, setM] = useState<CallMode>(cloudEnabled ? 'checking' : 'local-demo');
  useEffect(() => {
    if (!cloudEnabled) return;
    let alive = true;
    cloud.health().then((h) => { if (alive) setM(h?.liveCallingEnabled ? 'live' : 'server-demo'); });
    return () => { alive = false; };
  }, []);
  return m;
}
