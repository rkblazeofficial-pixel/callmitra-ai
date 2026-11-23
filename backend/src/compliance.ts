import { Config } from './config';

// ---- phone numbers -------------------------------------------------------
// Accepts +91XXXXXXXXXX, 91XXXXXXXXXX, 0XXXXXXXXXX or a plain 10-digit Indian mobile.
export function toE164(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, '');
  if (/^\+\d{11,15}$/.test(digits)) return digits;
  const d = digits.replace(/\D/g, '');
  if (/^[6-9]\d{9}$/.test(d)) return `+91${d}`;
  if (/^0[6-9]\d{9}$/.test(d)) return `+91${d.slice(1)}`;
  if (/^91[6-9]\d{9}$/.test(d)) return `+${d}`;
  return null;
}

// ---- calling hours -------------------------------------------------------
export function localHour(date: Date, timezone: string): number {
  const h = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: timezone }).format(date);
  return Number(h);
}
export function withinCallingHours(date: Date, c: Config['limits']): boolean {
  const h = localHour(date, c.timezone);
  return h >= c.windowStartHour && h < c.windowEndHour;
}

// ---- pre-call checks -----------------------------------------------------
export type GuardInput = {
  consentConfirmed: boolean;
  toNumber: string | null;
  optedOutLocally: boolean;
  optedOutAtProvider: boolean;
  callsTodayForUser: number;
  now: Date;
  limits: Config['limits'];
};
export type GuardResult = { ok: true } | { ok: false; code: string; message: string };

export function preCallGuard(g: GuardInput): GuardResult {
  if (!g.consentConfirmed) return { ok: false, code: 'consent_required', message: 'The recipient’s consent must be confirmed before calling.' };
  if (!g.toNumber) return { ok: false, code: 'invalid_number', message: 'Enter a valid phone number.' };
  if (g.optedOutLocally || g.optedOutAtProvider) return { ok: false, code: 'opted_out', message: 'This number has asked not to be called.' };
  if (!withinCallingHours(g.now, g.limits)) {
    return { ok: false, code: 'outside_calling_hours', message: `Calls are allowed only between ${g.limits.windowStartHour}:00 and ${g.limits.windowEndHour}:00 (${g.limits.timezone}).` };
  }
  if (g.callsTodayForUser >= g.limits.dailyCallsPerUser) return { ok: false, code: 'daily_limit', message: 'Daily call limit reached.' };
  return { ok: true };
}
