import { describe, expect, it } from 'vitest';
import { preCallGuard, toE164, withinCallingHours } from '../src/compliance';

const limits = { windowStartHour: 9, windowEndHour: 21, timezone: 'Asia/Kolkata', dailyCallsPerUser: 3, maxCallSeconds: 300, silenceIntervalSeconds: 15, silenceMaxCheckins: 2 };
const noon = new Date('2026-11-23T06:30:00Z'); // 12:00 IST
const night = new Date('2026-11-23T18:30:00Z'); // 00:00 IST
const ok = { consentConfirmed: true, toNumber: '+919876543210', optedOutLocally: false, optedOutAtProvider: false, callsTodayForUser: 0, now: noon, limits };

describe('toE164', () => {
  it.each([['9876543210', '+919876543210'], ['+91 98765 43210', '+919876543210'], ['09876543210', '+919876543210'], ['919876543210', '+919876543210'], ['+14155552671', '+14155552671']])('%s', (i, o) => expect(toE164(i)).toBe(o));
  it.each(['12345', 'abc', '5876543210', ''])('rejects %s', (i) => expect(toE164(i)).toBeNull());
});
describe('calling hours (IST)', () => {
  it('allows midday', () => expect(withinCallingHours(noon, limits)).toBe(true));
  it('blocks midnight', () => expect(withinCallingHours(night, limits)).toBe(false));
  it('blocks exactly 21:00', () => expect(withinCallingHours(new Date('2026-11-23T15:30:00Z'), limits)).toBe(false));
  it('allows exactly 09:00', () => expect(withinCallingHours(new Date('2026-11-23T03:30:00Z'), limits)).toBe(true));
});
describe('preCallGuard', () => {
  it('passes a clean request', () => expect(preCallGuard(ok)).toEqual({ ok: true }));
  it('requires consent', () => expect(preCallGuard({ ...ok, consentConfirmed: false })).toMatchObject({ ok: false, code: 'consent_required' }));
  it('rejects invalid numbers', () => expect(preCallGuard({ ...ok, toNumber: null })).toMatchObject({ code: 'invalid_number' }));
  it('blocks local opt-out', () => expect(preCallGuard({ ...ok, optedOutLocally: true })).toMatchObject({ code: 'opted_out' }));
  it('blocks provider opt-out', () => expect(preCallGuard({ ...ok, optedOutAtProvider: true })).toMatchObject({ code: 'opted_out' }));
  it('blocks outside hours', () => expect(preCallGuard({ ...ok, now: night })).toMatchObject({ code: 'outside_calling_hours' }));
  it('enforces the daily limit', () => expect(preCallGuard({ ...ok, callsTodayForUser: 3 })).toMatchObject({ code: 'daily_limit' }));
});
