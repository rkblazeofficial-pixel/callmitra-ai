import { describe, expect, it, vi } from 'vitest';
import { CloudError, createCloud, KV, StartCallInput } from './cloud-client';

const cfg = { apiUrl: 'https://api.test', supabaseUrl: 'https://proj.supabase.test', anonKey: 'anon' };
const mem = (): KV & { data: Map<string, string> } => { const data = new Map<string, string>(); return { data, get: async (k) => data.get(k) ?? null, set: async (k, v) => { data.set(k, v); }, remove: async (k) => { data.delete(k); } }; };
type R = { status: number; body?: any } | Error;
const mock = (...rs: R[]) => {
  const calls: { url: string; init: any }[] = [];
  const f = vi.fn(async (url: any, init: any) => {
    calls.push({ url: String(url), init });
    const r = rs.length > 1 ? rs.shift()! : rs[0];
    if (r instanceof Error) throw r;
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status });
  }) as unknown as typeof fetch;
  return { f, calls };
};
const tok = (n = 1, exp = 3600) => ({ access_token: `a${n}`, refresh_token: `r${n}`, expires_in: exp, user: { email: 'k@x.in', user_metadata: { name: 'Kamal' } } });
const input: StartCallInput = { recipientName: 'Rahul', phone: '9876543210', occasion: 'Birthday', occasionId: 'birthday', script: 's', language: 'hi', languageLabel: 'Hinglish',
  voice: 'rohan', hostName: 'Kamal', details: {}, qa: [], consentConfirmed: true, idempotencyKey: 'cm-aaaaaaaa' };

describe('auth', () => {
  it('signs in, stores the session and returns the profile name', async () => {
    const kv = mem(); const { f, calls } = mock({ status: 200, body: tok() });
    const r = await createCloud(cfg, f, kv).signIn('k@x.in', 'pw');
    expect(r).toEqual({ email: 'k@x.in', name: 'Kamal' });
    expect(calls[0].url).toBe('https://proj.supabase.test/auth/v1/token?grant_type=password');
    expect(calls[0].init.headers.apikey).toBe('anon');
    expect(JSON.parse(kv.data.get('callmitra:session')!).accessToken).toBe('a1');
  });
  it('surfaces the server message on bad credentials and stores nothing', async () => {
    const kv = mem(); const { f } = mock({ status: 400, body: { error_code: 'invalid_credentials', msg: 'Invalid login credentials' } });
    await expect(createCloud(cfg, f, kv).signIn('k@x.in', 'bad')).rejects.toMatchObject({ message: 'Invalid login credentials', code: 'invalid_credentials', status: 400 });
    expect(kv.data.size).toBe(0);
  });
  it('sign up: signed in when confirmation is off, confirm_email when it is on', async () => {
    const a = mem(); expect(await createCloud(cfg, mock({ status: 200, body: tok() }).f, a).signUp('e@x.in', 'secret1', 'K')).toEqual({ status: 'signed_in' });
    expect(a.data.size).toBe(1);
    const b = mem(); expect(await createCloud(cfg, mock({ status: 200, body: { id: 'u', email: 'e@x.in' } }).f, b).signUp('e@x.in', 'secret1', 'K')).toEqual({ status: 'confirm_email' });
    expect(b.data.size).toBe(0);
  });
  it('reports network failure as retryable with no status', async () => {
    await expect(createCloud(cfg, mock(new Error('offline')).f, mem()).signIn('a@b.in', 'x')).rejects.toMatchObject({ code: 'network', retryable: true, status: undefined });
  });
  it('signOut clears the session', async () => {
    const kv = mem(); const c = createCloud(cfg, mock({ status: 200, body: tok() }).f, kv);
    await c.signIn('k@x.in', 'pw'); expect(await c.hasSession()).toBe(true);
    await c.signOut(); expect(await c.hasSession()).toBe(false);
  });
});

describe('token refresh', () => {
  it('refreshes an expiring token, persists the rotated one and uses it', async () => {
    let t = 0; const kv = mem();
    const { f, calls } = mock({ status: 200, body: tok(1, 3600) }, { status: 200, body: tok(2, 3600) }, { status: 200, body: { status: 'completed' } });
    const c = createCloud(cfg, f, kv, () => t);
    await c.signIn('k@x.in', 'pw');
    t = 3600_000 - 30_000; // inside the 60s safety margin
    await c.getCall('c1');
    expect(calls[1].url).toContain('grant_type=refresh_token');
    expect(JSON.parse(calls[1].init.body)).toEqual({ refresh_token: 'r1' });
    expect(calls[2].init.headers.Authorization).toBe('Bearer a2');
    expect(JSON.parse(kv.data.get('callmitra:session')!).refreshToken).toBe('r2');
  });
  it('runs only one refresh for simultaneous requests', async () => {
    let t = 0; const kv = mem();
    const { f, calls } = mock({ status: 200, body: tok(1, 100) }, { status: 200, body: tok(2, 3600) }, { status: 200, body: { status: 'in_progress' } });
    const c = createCloud(cfg, f, kv, () => t);
    await c.signIn('k@x.in', 'pw'); t = 200_000;
    await Promise.all([c.getCall('1'), c.getCall('2'), c.getCall('3')]);
    expect(calls.filter((x) => x.url.includes('refresh_token'))).toHaveLength(1);
  });
  it('signs out when the refresh token is rejected', async () => {
    let t = 0; const kv = mem();
    const { f } = mock({ status: 200, body: tok(1, 100) }, { status: 400, body: { msg: 'Invalid Refresh Token' } });
    const c = createCloud(cfg, f, kv, () => t);
    await c.signIn('k@x.in', 'pw'); t = 200_000;
    await expect(c.getCall('1')).rejects.toBeInstanceOf(CloudError);
    expect(await c.hasSession()).toBe(false);
  });
  it('retries once with a fresh token after a 401 from the API', async () => {
    const kv = mem();
    const { f, calls } = mock({ status: 200, body: tok(1) }, { status: 401, body: { code: 'unauthorized' } }, { status: 200, body: tok(2) }, { status: 200, body: { status: 'completed' } });
    const c = createCloud(cfg, f, kv); await c.signIn('k@x.in', 'pw');
    expect((await c.getCall('1')).status).toBe('completed');
    expect(calls[3].init.headers.Authorization).toBe('Bearer a2');
  });
  it('fails clearly with no session', async () => {
    await expect(createCloud(cfg, mock({ status: 200 }).f, mem()).getCall('1')).rejects.toMatchObject({ code: 'no_session' });
  });
});

describe('calls', () => {
  const login = async (f: typeof fetch) => { const c = createCloud(cfg, f, mem()); await c.signIn('k@x.in', 'pw'); return c; };
  it('starts a live call and posts the full payload with the bearer token', async () => {
    const { f, calls } = mock({ status: 200, body: tok() }, { status: 202, body: { callId: 'c9', status: 'in_progress', mode: 'live' } });
    const r = await (await login(f)).startCall(input);
    expect(r).toMatchObject({ callId: 'c9', mode: 'live' });
    expect(calls[1].url).toBe('https://api.test/v1/calls');
    expect(calls[1].init.headers.Authorization).toBe('Bearer a1');
    expect(JSON.parse(calls[1].init.body)).toMatchObject({ idempotencyKey: 'cm-aaaaaaaa', consentConfirmed: true, voice: 'rohan' });
  });
  it('reports a demo response as demo, never as live', async () => {
    const { f } = mock({ status: 200, body: tok() }, { status: 200, body: { callId: 'c1', status: 'demo', mode: 'demo', message: 'Live calling is disabled. No call was placed.' } });
    expect(await (await login(f)).startCall(input)).toMatchObject({ mode: 'demo', message: expect.stringContaining('No call was placed') });
  });
  it.each([
    [422, { code: 'opted_out', message: 'This number has asked not to be called.' }, false],
    [503, { code: 'same_number_too_soon', message: 'wait', retryable: true }, true],
    [502, { code: 'voice_not_configured', message: 'No agent' }, true],
  ])('maps a %i error to a typed error', async (status, body, retryable) => {
    const { f } = mock({ status: 200, body: tok() }, { status, body });
    await expect((await login(f)).startCall(input)).rejects.toMatchObject({ code: body.code, status, retryable });
  });
  it('a lost response is flagged as a network error so the caller can reuse the idempotency key', async () => {
    const { f } = mock({ status: 200, body: tok() }, new Error('socket hang up'));
    const e = await (await login(f)).startCall(input).catch((x) => x);
    expect(e.isNetwork).toBe(true);
  });
  it('health reports whether live calling is on, and null when unreachable', async () => {
    expect(await createCloud(cfg, mock({ status: 200, body: { ok: true, liveCallingEnabled: false } }).f, mem()).health()).toEqual({ liveCallingEnabled: false });
    expect(await createCloud(cfg, mock(new Error('x')).f, mem()).health()).toBeNull();
  });
});
