import AsyncStorage from '@react-native-async-storage/async-storage';
import { CallRecord } from './store';

// Hand-off between the create flow and the call screen (kept out of URL params).
export type Pending = Omit<CallRecord, 'id' | 'durationSec' | 'status' | 'outcome' | 'createdAt'>;
export let pendingCall: Pending | null = null;
export const setPendingCall = (c: Pending | null) => { pendingCall = c; };

// Live calls keep running when the app is closed, so remember what the call was for.
const key = (id: string) => `callmitra:live:${id}`;
export const saveLiveCall = (id: string, c: Pending) => AsyncStorage.setItem(key(id), JSON.stringify({ ...c, startedAt: new Date().toISOString() })).catch(() => {});
export const loadLiveCall = async (id: string): Promise<(Pending & { startedAt?: string }) | null> => {
  try { const r = await AsyncStorage.getItem(key(id)); return r ? JSON.parse(r) : null; } catch { return null; }
};
export const clearLiveCall = (id: string) => AsyncStorage.removeItem(key(id)).catch(() => {});
