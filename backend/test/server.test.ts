import { createHmac } from 'node:crypto';
import { SignJWT } from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Config } from '../src/config';
import { CallProvider, ProviderError } from '../src/providers/types';
import { buildServer } from '../src/server';
import { MemoryStore } from '../src/store';

const JWT = 'test-jwt-secret-test-jwt-secret-1234';
const WH = 'whsec_test';
const noon = new Date('2026-11-23T06:30:00Z'); // 12:00 IST
const cfg = (live: boolean): Config => ({
  port: 0, liveCallingEnabled: live, supabaseJwtSecret: JWT,
  thunderphone: { apiKey: 'k', baseUrl: 'x', fromNumber: '+15551234567', webhookSecret: WH, agentId: undefined },
  limits: { maxCallSeconds: 300, silenceIntervalSeconds: 15, silenceMaxCheckins: 2, dailyCallsPerUser: 2, windowStartHour: 9, windowEndHour: 21, timezone: 'Asia/Kolkata' },
});
const token = (sub: string) => new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(sub).setExpirationTime('1h').sign(new TextEncoder().encode(JWT));
const payload = (over: any = {}) => ({ recipientName: 'Rahul', phone: '9876543210', script: 'Namaste', language: 'hi', voice: 'rohan', hostName: 'Kamal',
  occasion: 'birthday', idempotencyKey: 'key-00000001', consentConfirmed: true, details: { date: 'Sunday' }, ...over });

const provider = (): CallProvider & { placeCall: any; isOptedOut: any } => ({
  name: 't', isOptedOut: vi.fn(async () => false), addOptOut: vi.fn(async () => {}),
  placeCall: vi.fn(async () => ({ providerCallId: '99', status: 'initiated' as const })),
  getCall: vi.fn(async () => ({ providerCallId: '99', status: 'in_progress' as const })), cancelQueued: vi.fn(async () => {}),
});

async function post(app: any, body: any, tok?: string) {
  return app.inject({ method: 'POST', url: '/v1/calls', payload: body, headers: tok ? { authorization: `Bearer ${tok}` } : {} });
}

describe('POST /v1/calls', () => {
  let store: MemoryStore;
  beforeEach(() => { store = new MemoryStore(); });

  it('rejects unauthenticated requests', async () => {
    const app = buildServer({ config: cfg(true), store, provider: provider(), now: () => noon });
    expect((await post(app, payload())).statusCode).toBe(401);
    expect((await post(app, payload(), 'garbage')).statusCode).toBe(401);
  });
  it('DEMO mode never calls the provider and says so', async () => {
    const p = provider();
    const app = buildServer({ config: cfg(false), store, provider: p, now: () => noon });
    const r = await post(app, payload(), await token('u1'));
    expect(r.json()).toMatchObject({ mode: 'demo', status: 'demo' });
    expect(p.placeCall).not.toHaveBeenCalled();
  });
  it('places a live call when every guard passes', async () => {
    const p = provider();
    const app = buildServer({ config: cfg(true), store, provider: p, now: () => noon });
    const r = await post(app, payload(), await token('u1'));
    expect(r.statusCode).toBe(202);
    expect(r.json()).toMatchObject({ mode: 'live', status: 'in_progress' });
    expect(p.placeCall.mock.calls[0][0]).toMatchObject({ toNumber: '+919876543210', voice: 'rohan', language: 'hi' });
  });
  it('does not dial twice for the same idempotency key', async () => {
    const p = provider();
    const app = buildServer({ config: cfg(true), store, provider: p, now: () => noon });
    const t = await token('u1');
    await post(app, payload(), t);
    const r2 = await post(app, payload(), t);
    expect(r2.json().replay).toBe(true);
    expect(p.placeCall).toHaveBeenCalledTimes(1);
  });
  it.each([
    ['no consent', { consentConfirmed: false }, 'consent_required'],
    ['bad number', { phone: '123' }, 'invalid_number'],
  ])('refuses: %s', async (_n, over, code) => {
    const p = provider();
    const app = buildServer({ config: cfg(true), store, provider: p, now: () => noon });
    const r = await post(app, payload(over), await token('u1'));
    expect(r.statusCode).toBe(422); expect(r.json().code).toBe(code); expect(p.placeCall).not.toHaveBeenCalled();
  });
  it('refuses outside calling hours', async () => {
    const p = provider();
    const app = buildServer({ config: cfg(true), store, provider: p, now: () => new Date('2026-11-23T18:30:00Z') });
    expect((await post(app, payload(), await token('u1'))).json().code).toBe('outside_calling_hours');
    expect(p.placeCall).not.toHaveBeenCalled();
  });
  it('refuses opted-out numbers (local and provider lists)', async () => {
    const p = provider();
    const app = buildServer({ config: cfg(true), store, provider: p, now: () => noon });
    await store.addOptOut('+919876543210');
    expect((await post(app, payload(), await token('u1'))).json().code).toBe('opted_out');
    const store2 = new MemoryStore(); const p2 = provider(); p2.isOptedOut.mockResolvedValue(true);
    const app2 = buildServer({ config: cfg(true), store: store2, provider: p2, now: () => noon });
    expect((await post(app2, payload({ idempotencyKey: 'key-00000002' }), await token('u1'))).json().code).toBe('opted_out');
    expect(p2.placeCall).not.toHaveBeenCalled();
  });
  it('fails closed when the opt-out list cannot be checked', async () => {
    const p = provider(); p.isOptedOut.mockRejectedValue(new Error('down'));
    const app = buildServer({ config: cfg(true), store, provider: p, now: () => noon });
    const r = await post(app, payload(), await token('u1'));
    expect(r.statusCode).toBe(502); expect(p.placeCall).not.toHaveBeenCalled();
  });
  it('enforces the per-user daily limit', async () => {
    const p = provider();
    const app = buildServer({ config: cfg(true), store, provider: p, now: () => noon });
    const t = await token('u1');
    await post(app, payload({ idempotencyKey: 'key-0000000a' }), t);
    await post(app, payload({ idempotencyKey: 'key-0000000b' }), t);
    expect((await post(app, payload({ idempotencyKey: 'key-0000000c' }), t)).json().code).toBe('daily_limit');
  });
  it('reports provider failures honestly, never as success', async () => {
    const p = provider(); p.placeCall.mockRejectedValue(new ProviderError('no outbound', 409, 'managed_number_outbound_pending', false));
    const app = buildServer({ config: cfg(true), store, provider: p, now: () => noon });
    const r = await post(app, payload(), await token('u1'));
    expect(r.statusCode).toBe(502); expect(r.json().code).toBe('managed_number_outbound_pending');
    expect([...store.calls.values()][0].status).toBe('failed');
  });
  it('isolates users: one user cannot read another’s call', async () => {
    const app = buildServer({ config: cfg(false), store, provider: provider(), now: () => noon });
    const made = (await post(app, payload(), await token('u1'))).json();
    const other = await app.inject({ method: 'GET', url: `/v1/calls/${made.callId}`, headers: { authorization: `Bearer ${await token('u2')}` } });
    expect(other.statusCode).toBe(404);
    const own = await app.inject({ method: 'GET', url: `/v1/calls/${made.callId}`, headers: { authorization: `Bearer ${await token('u1')}` } });
    expect(own.statusCode).toBe(200);
  });
});

describe('POST /webhooks/thunderphone', () => {
  const sign = (body: string, t: number, secret = WH) =>
    `t=${t},v1=${createHmac('sha256', secret).update(`${t}\nPOST\n/webhooks/thunderphone\n${body}`).digest('hex')}`;
  const send = (app: any, body: string, header?: string) => app.inject({ method: 'POST', url: '/webhooks/thunderphone', payload: body,
    headers: { 'content-type': 'application/json', ...(header ? { 'x-thunderphone-signature-v2': header } : {}) } });
  const t = Math.floor(noon.getTime() / 1000);

  it('rejects missing or invalid signatures and stale timestamps', async () => {
    const app = buildServer({ config: cfg(true), store: new MemoryStore(), provider: provider(), now: () => noon });
    const body = JSON.stringify({ type: 'telephony.complete', event_id: 'e1', data: { call_id: 99, status: 'completed' } });
    expect((await send(app, body)).statusCode).toBe(401);
    expect((await send(app, body, sign(body, t, 'wrong'))).statusCode).toBe(401);
    expect((await send(app, body, sign(body, t - 400))).statusCode).toBe(401);
  });
  it('updates the call, dedupes events and mirrors provider opt-outs', async () => {
    const store = new MemoryStore(); const p = provider(); p.isOptedOut.mockResolvedValue(true);
    const app = buildServer({ config: cfg(true), store, provider: p, now: () => noon });
    await store.saveCall({ id: 'c1', userId: 'u1', idempotencyKey: 'k', toNumber: '+919876543210', recipientName: 'R', providerCallId: '99', status: 'in_progress', createdAt: noon.toISOString(), mode: 'live' });
    const body = JSON.stringify({ type: 'telephony.complete', event_id: 'e2', data: { call_id: 99, status: 'completed', end_reason: 'ai_hangup', duration_seconds: 41 } });
    expect((await send(app, body, sign(body, t))).statusCode).toBe(200);
    const row = store.calls.get('c1')!;
    expect(row).toMatchObject({ status: 'completed', endReason: 'ai_hangup', durationSeconds: 41 });
    expect(await store.isOptedOut('+919876543210')).toBe(true);
    expect((await send(app, body, sign(body, t))).json().duplicate).toBe(true);
  });
});
