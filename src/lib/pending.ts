import { CallRecord } from './store';
// Hand-off between the create flow and the call screen (kept out of URL params).
export let pendingCall: Omit<CallRecord, 'id' | 'durationSec' | 'status' | 'outcome' | 'createdAt'> | null = null;
export const setPendingCall = (c: typeof pendingCall) => { pendingCall = c; };
