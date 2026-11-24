import { CallProvider, PlaceCallInput, PlaceCallResult, ProviderCall, ProviderError } from './types';

type Opts = { apiKey: string; baseUrl: string; fromNumber: string; agentId?: number; allowInline?: boolean; fetchImpl?: typeof fetch };

// Adapter for ThunderPhone's REST API (docs: /api-reference/outbound-calls, /opt-outs, /calls).
// NOT yet exercised against the live API: the account has no phone number or outbound approval.
export class ThunderPhoneProvider implements CallProvider {
  readonly name = 'thunderphone';
  private f: typeof fetch;
  constructor(private o: Opts) { this.f = o.fetchImpl ?? fetch; }

  private async req(method: string, path: string, body?: unknown) {
    const res = await this.f(`${this.o.baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.o.apiKey}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json: any = {};
    try { json = text ? JSON.parse(text) : {}; } catch { /* non-JSON error body */ }
    return { res, json };
  }

  private fail(res: Response, json: any): never {
    const code = json?.code ?? json?.error?.code ?? json?.reason;
    const detail = json?.detail ?? json?.message ?? `ThunderPhone returned ${res.status}`;
    // 429 and 5xx are worth retrying later; everything else needs a human to fix.
    throw new ProviderError(String(detail), res.status, code, res.status === 429 || res.status >= 500);
  }

  async isOptedOut(toNumber: string) {
    const q = new URLSearchParams({ number: toNumber, channel: 'call' });
    const { res, json } = await this.req('GET', `/v1/opt-outs?${q}`);
    if (!res.ok) this.fail(res, json);
    return (json.results ?? []).some((r: any) => r.blocks === true);
  }

  async addOptOut(toNumber: string) {
    const { res, json } = await this.req('POST', '/v1/opt-outs', { number: toNumber, channel: 'call' });
    if (!res.ok) this.fail(res, json);
  }

  async placeCall(i: PlaceCallInput): Promise<PlaceCallResult> {
    const base = { from_number: this.o.fromNumber, to_number: i.toNumber, language: i.language, idempotency_key: i.idempotencyKey };
    const agentId = i.agentId ?? this.o.agentId;
    if (agentId === undefined && !this.o.allowInline) {
      // Fail closed: an inline config has no documented max-duration limit, so a runaway call could not be capped.
      throw new ProviderError('No saved ThunderPhone agent is configured for this voice. Inline calls cannot enforce a maximum call duration.', 400, 'voice_not_configured', false);
    }
    const body = agentId !== undefined
      ? { ...base, agent_id: agentId, context: i.prompt }
      : {
          ...base,
          config: {
            prompt: i.prompt,
            voice: i.voice,
            product: 'bolt',
            language: i.language,
            voice_speed: i.voiceSpeed ?? 1.0,
            silence_checkins_enabled: true,
            silence_interval_seconds: i.silenceIntervalSeconds,
            silence_max_checkins: i.silenceMaxCheckins,
            silence_final_action: 'hang_up',
            voicemail_action: 'hangup', // never leave an AI message on voicemail
            tools: [],
          },
        };
    const { res, json } = await this.req('POST', '/v1/call', body);
    if (res.status === 201 || res.status === 200) {
      return { providerCallId: String(json.call_id), status: 'initiated', replay: json.idempotent_replay === true };
    }
    if (res.status === 202) return { providerCallId: String(json.call_id), status: 'unknown' };
    this.fail(res, json);
  }

  async getCall(id: string): Promise<ProviderCall> {
    const { res, json } = await this.req('GET', `/v1/calls/${encodeURIComponent(id)}`);
    if (!res.ok) this.fail(res, json);
    const status = json.queued_at ? 'queued' : json.status === 'completed' ? 'completed' : json.status === 'failed' ? 'failed' : 'in_progress';
    return { providerCallId: String(json.call_id ?? id), status, endReason: json.end_reason, answeredBy: json.answered_by ?? null, durationSeconds: json.duration_seconds ?? null };
  }

  async cancelQueued(id: string) {
    const { res, json } = await this.req('POST', `/v1/calls/${encodeURIComponent(id)}/cancel`);
    if (!res.ok) this.fail(res, json);
  }
}
