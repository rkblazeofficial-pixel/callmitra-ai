import { describe, expect, it, vi } from 'vitest';
import { ThunderPhoneProvider } from '../src/providers/thunderphone';
import { ProviderError } from '../src/providers/types';

const mk = (responses: { status: number; body: any }[], agentId?: number, allowInline = true) => {
  const calls: { url: string; init: any }[] = [];
  const f = vi.fn(async (url: any, init: any) => {
    calls.push({ url: String(url), init });
    const r = responses.shift()!;
    return new Response(JSON.stringify(r.body), { status: r.status });
  }) as unknown as typeof fetch;
  return { p: new ThunderPhoneProvider({ apiKey: 'sk_test', baseUrl: 'https://api.example.test', fromNumber: '+15551234567', agentId, allowInline, fetchImpl: f }), calls };
};
const input = { toNumber: '+919876543210', prompt: 'P', voice: 'rohan', language: 'hi', maxCallSeconds: 300, silenceIntervalSeconds: 15, silenceMaxCheckins: 2, idempotencyKey: 'k1' };

describe('ThunderPhoneProvider (mocked HTTP)', () => {
  it('places an inline-config call with safe settings', async () => {
    const { p, calls } = mk([{ status: 201, body: { call_id: 42, status: 'initiated' } }]);
    const r = await p.placeCall(input);
    expect(r).toEqual({ providerCallId: '42', status: 'initiated', replay: false });
    const body = JSON.parse(calls[0].init.body);
    expect(calls[0].url).toBe('https://api.example.test/v1/call');
    expect(calls[0].init.headers.Authorization).toBe('Bearer sk_test');
    expect(body).toMatchObject({ from_number: '+15551234567', to_number: '+919876543210', idempotency_key: 'k1' });
    expect(body.config).toMatchObject({ prompt: 'P', voice: 'rohan', product: 'bolt', voicemail_action: 'hangup', silence_final_action: 'hang_up' });
  });
  it('uses a saved agent with the prompt as context when configured', async () => {
    const { p, calls } = mk([{ status: 201, body: { call_id: 1 } }], 12);
    await p.placeCall(input);
    const body = JSON.parse(calls[0].init.body);
    expect(body.agent_id).toBe(12); expect(body.context).toBe('P'); expect(body.config).toBeUndefined();
  });
  it('refuses to dial inline when no saved agent exists and inline is not allowed (duration cannot be capped)', async () => {
    const { p, calls } = mk([{ status: 201, body: { call_id: 1 } }], undefined, false);
    await expect(p.placeCall(input)).rejects.toMatchObject({ code: 'voice_not_configured', retryable: false });
    expect(calls).toHaveLength(0);
  });
  it('a per-call agent id wins over the default agent', async () => {
    const { p, calls } = mk([{ status: 201, body: { call_id: 1 } }], 12, false);
    await p.placeCall({ ...input, agentId: 31 });
    expect(JSON.parse(calls[0].init.body).agent_id).toBe(31);
  });
  it('flags idempotent replays and ambiguous 202', async () => {
    expect((await mk([{ status: 200, body: { call_id: 7, idempotent_replay: true } }]).p.placeCall(input)).replay).toBe(true);
    expect((await mk([{ status: 202, body: { call_id: 8, status: 'unknown' } }]).p.placeCall(input)).status).toBe('unknown');
  });
  it('maps errors, marking 429 and 5xx retryable', async () => {
    await expect(mk([{ status: 403, body: { code: 'outbound_tcpa_confirmation_required', detail: 'x' } }]).p.placeCall(input)).rejects.toMatchObject({ code: 'outbound_tcpa_confirmation_required', retryable: false });
    await expect(mk([{ status: 429, body: { code: 'same_number_too_soon' } }]).p.placeCall(input)).rejects.toMatchObject({ retryable: true });
    await expect(mk([{ status: 502, body: {} }]).p.placeCall(input)).rejects.toBeInstanceOf(ProviderError);
  });
  it('reads opt-outs, honoring blocks=false carrier rows', async () => {
    expect(await mk([{ status: 200, body: { results: [{ blocks: true }] } }]).p.isOptedOut('+919876543210')).toBe(true);
    expect(await mk([{ status: 200, body: { results: [{ blocks: false }] } }]).p.isOptedOut('+919876543210')).toBe(false);
    expect(await mk([{ status: 200, body: { results: [] } }]).p.isOptedOut('+919876543210')).toBe(false);
  });
  it('maps call state, treating queued_at as queued', async () => {
    expect((await mk([{ status: 200, body: { call_id: 1, status: 'in_progress', queued_at: 'x' } }]).p.getCall('1')).status).toBe('queued');
    expect((await mk([{ status: 200, body: { call_id: 1, status: 'completed', end_reason: 'user_hangup', duration_seconds: 54 } }]).p.getCall('1'))).toMatchObject({ status: 'completed', endReason: 'user_hangup', durationSeconds: 54 });
  });
});
