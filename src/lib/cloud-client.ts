// Pure client for Supabase Auth (GoTrue REST) and the CallMitra backend.
// fetch and storage are injected so this file is unit-tested without a phone.
export type CloudConfig = { apiUrl: string; supabaseUrl: string; anonKey: string };
export type KV = { get(k: string): Promise<string | null>; set(k: string, v: string): Promise<void>; remove(k: string): Promise<void> };
type Session = { accessToken: string; refreshToken: string; expiresAt: number };

export class CloudError extends Error {
  constructor(message: string, readonly code?: string, readonly status?: number, readonly retryable = false) { super(message); }
  /** True when no HTTP response arrived: the request may or may not have been processed. */
  get isNetwork() { return this.status === undefined; }
}

export type StartCallInput = {
  recipientName: string; phone: string; relation?: string; occasion: string; occasionId: string; script: string;
  language: string; languageLabel: string; voice: string; voiceSpeed?: number; hostName: string;
  details: { date?: string; time?: string; venue?: string }; qa: { q: string; a: string }[];
  consentConfirmed: boolean; idempotencyKey: string;
};
export type StartCallResult = { callId: string; status: string; mode: 'live' | 'demo'; replay?: boolean; message?: string };
export type CallState = { callId: string; status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'demo'; mode: 'live' | 'demo'; endReason: string | null; durationSeconds: number | null };

const SESSION_KEY = 'callmitra:session';
const TIMEOUT_MS = 20000;

export function createCloud(cfg: CloudConfig, fetchImpl: typeof fetch, kv: KV, now: () => number = Date.now) {
  const authBase = `${cfg.supabaseUrl.replace(/\/$/, '')}/auth/v1`;
  const apiBase = cfg.apiUrl.replace(/\/$/, '');
  let refreshing: Promise<Session> | null = null;

  async function http(url: string, init: RequestInit): Promise<{ status: number; json: any }> {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const res = await fetchImpl(url, { ...init, signal: ctl.signal });
      const text = await res.text();
      let json: any = {};
      try { json = text ? JSON.parse(text) : {}; } catch { /* non-JSON body */ }
      return { status: res.status, json };
    } catch {
      throw new CloudError('Could not reach the server. Check your internet connection and try again.', 'network', undefined, true);
    } finally { clearTimeout(timer); }
  }

  const authHeaders = { apikey: cfg.anonKey, 'Content-Type': 'application/json' };
  const authError = (r: { status: number; json: any }) =>
    new CloudError(r.json.msg ?? r.json.error_description ?? r.json.message ?? 'Something went wrong. Please try again.', r.json.error_code ?? r.json.error, r.status, r.status >= 500 || r.status === 429);

  const toSession = (j: any): Session => ({ accessToken: j.access_token, refreshToken: j.refresh_token, expiresAt: now() + (Number(j.expires_in) || 3600) * 1000 });
  const save = (s: Session) => kv.set(SESSION_KEY, JSON.stringify(s));
  const load = async (): Promise<Session | null> => { try { const r = await kv.get(SESSION_KEY); return r ? JSON.parse(r) : null; } catch { return null; } };

  async function refresh(s: Session): Promise<Session> {
    // One refresh at a time: refresh tokens rotate, so parallel refreshes would invalidate each other.
    if (!refreshing) {
      refreshing = (async () => {
        const r = await http(`${authBase}/token?grant_type=refresh_token`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ refresh_token: s.refreshToken }) });
        if (r.status !== 200 || !r.json.access_token) {
          if (r.status === 400 || r.status === 401) await kv.remove(SESSION_KEY); // refresh token is dead: signed out
          throw authError(r);
        }
        const ns = toSession(r.json); await save(ns); return ns;
      })().finally(() => { refreshing = null; });
    }
    return refreshing;
  }

  async function accessToken(): Promise<string> {
    const s = await load();
    if (!s) throw new CloudError('Please log in again.', 'no_session', 401);
    return now() > s.expiresAt - 60_000 ? (await refresh(s)).accessToken : s.accessToken;
  }

  async function api(method: 'GET' | 'POST', path: string, body?: unknown, retried = false): Promise<{ status: number; json: any }> {
    const token = await accessToken();
    const r = await http(`${apiBase}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (r.status === 401 && !retried) { const s = await load(); if (s) { await refresh(s); return api(method, path, body, true); } }
    return r;
  }
  const apiError = (r: { status: number; json: any }) =>
    new CloudError(r.json.message ?? 'The server could not complete the request.', r.json.code, r.status, r.json.retryable === true || r.status === 429 || r.status >= 500);

  return {
    async signUp(email: string, password: string, name: string): Promise<{ status: 'signed_in' | 'confirm_email' }> {
      const r = await http(`${authBase}/signup`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ email, password, data: { name } }) });
      if (r.status >= 400) throw authError(r);
      if (r.json.access_token) { await save(toSession(r.json)); return { status: 'signed_in' }; }
      return { status: 'confirm_email' };
    },
    async signIn(email: string, password: string): Promise<{ email: string; name?: string }> {
      const r = await http(`${authBase}/token?grant_type=password`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ email, password }) });
      if (r.status !== 200 || !r.json.access_token) throw authError(r);
      await save(toSession(r.json));
      return { email: r.json.user?.email ?? email, name: r.json.user?.user_metadata?.name };
    },
    async recover(email: string) {
      const r = await http(`${authBase}/recover`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ email }) });
      if (r.status >= 400) throw authError(r);
    },
    async signOut() { await kv.remove(SESSION_KEY); },
    async hasSession() { return (await load()) !== null; },

    async health(): Promise<{ liveCallingEnabled: boolean } | null> {
      try { const r = await http(`${apiBase}/health`, { method: 'GET' }); return r.status === 200 ? { liveCallingEnabled: r.json.liveCallingEnabled === true } : null; } catch { return null; }
    },
    async startCall(input: StartCallInput): Promise<StartCallResult> {
      const r = await api('POST', '/v1/calls', input);
      if (r.status >= 400) throw apiError(r);
      return { callId: r.json.callId, status: r.json.status, mode: r.json.mode === 'demo' ? 'demo' : 'live', replay: r.json.replay === true, message: r.json.message };
    },
    async getCall(id: string): Promise<CallState> {
      const r = await api('GET', `/v1/calls/${encodeURIComponent(id)}`);
      if (r.status >= 400) throw apiError(r);
      return r.json;
    },
  };
}
export type Cloud = ReturnType<typeof createCloud>;
