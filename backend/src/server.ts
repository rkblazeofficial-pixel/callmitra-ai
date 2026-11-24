import { createHash, randomUUID } from 'node:crypto';
import Fastify, { FastifyInstance } from 'fastify';
import { KeySource, keySourceFromEnv, verifyUser } from './auth';
import { Config, config as defaultConfig } from './config';
import { preCallGuard, toE164 } from './compliance';
import { buildPrompt, CallFacts } from './prompt';
import { CallProvider, ProviderError } from './providers/types';
import { ThunderPhoneProvider } from './providers/thunderphone';
import { PgStore } from './pg-store';
import { CallRow, MemoryStore, Store } from './store';
import { verifySignatureV2 } from './webhook/verify';

type Deps = { config: Config; store: Store; provider?: CallProvider; now?: () => Date; keys?: KeySource };

export function buildServer(deps: Deps): FastifyInstance {
  const { config, store } = deps;
  const now = deps.now ?? (() => new Date());
  const keys = deps.keys ?? keySourceFromEnv(config);
  const app = Fastify({ logger: false, bodyLimit: 256 * 1024 });

  const OCCASIONS = new Set(['birthday', 'wedding', 'engagement', 'anniversary', 'festival', 'housewarming', 'baby', 'congrats', 'party', 'family', 'custom']);
  const validOccasion = (v: unknown) => (typeof v === 'string' && OCCASIONS.has(v) ? v : undefined);
  const replayOf = async (userId: string, key: string, reply: any) => {
    const ex = await store.findCallByKey(userId, key);
    return reply.code(200).send({ callId: ex?.id, status: ex?.status, mode: ex?.mode, replay: true });
  };
  const liveReady = () => config.liveCallingEnabled && !!deps.provider && !!config.thunderphone.fromNumber;

  app.get('/health', async () => ({ ok: true, liveCallingEnabled: config.liveCallingEnabled, providerConfigured: !!deps.provider }));

  // ---- POST /v1/calls -------------------------------------------------------
  app.post('/v1/calls', async (req, reply) => {
    const userId = await verifyUser(req.headers.authorization, keys);
    if (!userId) return reply.code(401).send({ code: 'unauthorized' });
    const b = req.body as any;
    const bad = (m: string) => reply.code(400).send({ code: 'bad_request', message: m });
    if (!b || typeof b !== 'object') return bad('Body required.');
    for (const k of ['recipientName', 'phone', 'script', 'language', 'voice', 'hostName', 'occasion', 'idempotencyKey'])
      if (typeof b[k] !== 'string' || !b[k].trim()) return bad(`Missing ${k}.`);
    if (b.idempotencyKey.length < 8 || b.idempotencyKey.length > 100) return bad('idempotencyKey must be 8–100 characters.');

    const existing = await store.findCallByKey(userId, b.idempotencyKey);
    if (existing) return reply.code(200).send({ callId: existing.id, status: existing.status, mode: existing.mode, replay: true });

    const toNumber = toE164(b.phone);
    // DEMO mode: never touches a provider and is never reported as a real call.
    if (!liveReady()) {
      const row: CallRow = { id: randomUUID(), userId, idempotencyKey: b.idempotencyKey, toNumber: toNumber ?? '', recipientName: b.recipientName,
        language: b.language, voiceId: b.voice, occasionId: validOccasion(b.occasionId),
        status: 'demo', createdAt: now().toISOString(), mode: 'demo' };
      if (!(await store.createCall(row))) return replayOf(userId, b.idempotencyKey, reply);
      return reply.code(200).send({ callId: row.id, status: 'demo', mode: 'demo', message: 'Live calling is disabled. No call was placed.' });
    }

    const provider = deps.provider!;
    let optedOutAtProvider = false;
    try { if (toNumber) optedOutAtProvider = await provider.isOptedOut(toNumber); }
    catch (e) { return reply.code(502).send({ code: 'opt_out_check_failed', message: 'Could not verify the opt-out list. No call was placed.' }); }

    const dayAgo = new Date(now().getTime() - 24 * 3600 * 1000);
    const guard = preCallGuard({
      consentConfirmed: b.consentConfirmed === true, toNumber,
      optedOutLocally: toNumber ? await store.isOptedOut(toNumber) : false, optedOutAtProvider,
      callsTodayForUser: await store.countCallsSince(userId, dayAgo), now: now(), limits: config.limits,
    });
    if (!guard.ok) return reply.code(422).send({ code: guard.code, message: guard.message });

    const facts: CallFacts = {
      hostName: b.hostName, recipientName: b.recipientName, relation: b.relation, occasion: b.occasion,
      script: b.script, details: b.details ?? {}, qa: b.qa, language: b.languageLabel ?? b.language,
    };
    const id = randomUUID();
    const row: CallRow = { id, userId, idempotencyKey: b.idempotencyKey, toNumber: toNumber!, recipientName: b.recipientName,
      language: b.language, voiceId: b.voice, occasionId: validOccasion(b.occasionId),
      status: 'queued', createdAt: now().toISOString(), mode: 'live' };
    // Atomic insert BEFORE dialing: a concurrent or repeated request with the same key loses here and never dials.
    if (!(await store.createCall(row))) return replayOf(userId, b.idempotencyKey, reply);
    try {
      const r = await provider.placeCall({
        toNumber: toNumber!, prompt: buildPrompt(facts), voice: b.voice, language: b.language,
        voiceSpeed: typeof b.voiceSpeed === 'number' ? b.voiceSpeed : undefined,
        maxCallSeconds: config.limits.maxCallSeconds, silenceIntervalSeconds: config.limits.silenceIntervalSeconds,
        silenceMaxCheckins: config.limits.silenceMaxCheckins,
        agentId: config.thunderphone.agentMap[b.voice] ?? config.thunderphone.agentId,
        idempotencyKey: createHash('sha256').update(`${userId}:${b.idempotencyKey}`).digest('hex').slice(0, 64),
      });
      row.providerCallId = r.providerCallId;
      row.status = 'in_progress';
      await store.updateCall(row);
      return reply.code(202).send({ callId: id, status: row.status, mode: 'live' });
    } catch (e) {
      row.status = 'failed';
      row.endReason = e instanceof ProviderError ? (e.code ?? 'provider_error') : 'provider_error';
      await store.updateCall(row);
      const retryable = e instanceof ProviderError && e.retryable;
      return reply.code(retryable ? 503 : 502).send({ code: row.endReason, message: e instanceof Error ? e.message : 'Provider error', retryable });
    }
  });

  // ---- GET /v1/calls/:id (live state comes from the provider) ----------------
  app.get('/v1/calls/:id', async (req, reply) => {
    const userId = await verifyUser(req.headers.authorization, keys);
    if (!userId) return reply.code(401).send({ code: 'unauthorized' });
    const row = await store.findCall(userId, (req.params as any).id);
    if (!row) return reply.code(404).send({ code: 'not_found' });
    if (row.mode === 'live' && row.providerCallId && deps.provider && row.status !== 'completed' && row.status !== 'failed') {
      try {
        const pc = await deps.provider.getCall(row.providerCallId);
        row.status = pc.status; row.endReason = pc.endReason; row.durationSeconds = pc.durationSeconds;
        await store.updateCall(row);
      } catch { /* keep last known state */ }
    }
    return { callId: row.id, status: row.status, mode: row.mode, endReason: row.endReason ?? null, durationSeconds: row.durationSeconds ?? null };
  });

  // ---- POST /webhooks/thunderphone ------------------------------------------
  app.register(async (hooks) => {
    // Keep raw bytes: the signature covers them exactly.
    hooks.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => done(null, body));
    hooks.post('/webhooks/thunderphone', async (req, reply) => {
      const raw = req.body as Buffer;
      const ok = verifySignatureV2({
        header: req.headers['x-thunderphone-signature-v2'] as string | undefined,
        secret: config.thunderphone.webhookSecret, method: req.method, path: req.raw.url ?? '', body: raw, now: Math.floor(now().getTime() / 1000),
      });
      if (!ok) return reply.code(401).send({ code: 'bad_signature' });
      let evt: any;
      try { evt = JSON.parse(raw.toString('utf8')); } catch { return reply.code(400).send({ code: 'bad_json' }); }
      if (evt.event_id && (await store.hasEvent(evt.event_id))) return reply.code(200).send({ ok: true, duplicate: true });

      if (evt.type === 'telephony.complete' && evt.data?.call_id !== undefined) {
        const row = await store.findCallByProviderId(String(evt.data.call_id));
        if (row) {
          row.status = evt.data.status === 'failed' ? 'failed' : 'completed';
          row.endReason = evt.data.end_reason; row.durationSeconds = evt.data.duration_seconds ?? null;
          await store.updateCall(row);
          // Mirror provider-side opt-outs ("don't call me again") into our own suppression list.
          if (deps.provider && row.toNumber) {
            try { if (await deps.provider.isOptedOut(row.toNumber)) await store.addOptOut(row.toNumber, row.userId); } catch { /* retried on next event */ }
          }
        }
      }
      // Recorded only after processing succeeded, so a failed attempt is retried by the provider instead of being lost.
      if (evt.event_id) await store.recordEvent(evt.event_id);
      return reply.code(200).send({ ok: true });
    });
  });

  return app;
}

// ---- entrypoint ---------------------------------------------------------------
export async function main() {
  const c = defaultConfig;
  const t = c.thunderphone;
  let store: Store = new MemoryStore();
  if (c.databaseUrl) {
    const { default: pg } = await import('pg');
    store = new PgStore(new pg.Pool({ connectionString: c.databaseUrl, max: 5 }));
  }
  if (c.liveCallingEnabled) {
    const missing = [
      !c.databaseUrl && 'DATABASE_URL (live calls need the durable store so opt-outs survive restarts)',
      !t.apiKey && 'THUNDERPHONE_API_KEY', !t.fromNumber && 'THUNDERPHONE_FROM_NUMBER', !t.webhookSecret && 'THUNDERPHONE_WEBHOOK_SECRET',
      !c.supabaseUrl && !c.supabaseJwtSecret && 'SUPABASE_URL or SUPABASE_JWT_SECRET',
      !t.allowInline && t.agentId === undefined && Object.keys(t.agentMap).length === 0 && 'THUNDERPHONE_AGENT_MAP or THUNDERPHONE_AGENT_ID (saved agents enforce the max call duration)',
    ].filter(Boolean);
    if (missing.length) throw new Error(`LIVE_CALLING_ENABLED=true but missing: ${missing.join(', ')}`);
  }
  const provider = t.apiKey ? new ThunderPhoneProvider({ apiKey: t.apiKey, baseUrl: t.baseUrl, fromNumber: t.fromNumber, agentId: t.agentId, allowInline: t.allowInline }) : undefined;
  await buildServer({ config: c, store, provider }).listen({ port: c.port, host: '0.0.0.0' });
  console.log(`CallMitra backend on :${c.port} (live calling ${c.liveCallingEnabled ? 'ON' : 'OFF'}, store ${c.databaseUrl ? 'postgres' : 'memory'})`);
}
if (process.argv[1] && /server\.(ts|js)$/.test(process.argv[1])) main().catch((e) => { console.error(e.message); process.exit(1); });
