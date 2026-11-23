import { createHash, randomUUID } from 'node:crypto';
import Fastify, { FastifyInstance } from 'fastify';
import { verifyUser } from './auth';
import { Config, config as defaultConfig } from './config';
import { preCallGuard, toE164 } from './compliance';
import { buildPrompt, CallFacts } from './prompt';
import { CallProvider, ProviderError } from './providers/types';
import { ThunderPhoneProvider } from './providers/thunderphone';
import { CallRow, MemoryStore, Store } from './store';
import { verifySignatureV2 } from './webhook/verify';

type Deps = { config: Config; store: Store; provider?: CallProvider; now?: () => Date };

export function buildServer(deps: Deps): FastifyInstance {
  const { config, store } = deps;
  const now = deps.now ?? (() => new Date());
  const app = Fastify({ logger: false, bodyLimit: 256 * 1024 });

  const liveReady = () => config.liveCallingEnabled && !!deps.provider && !!config.thunderphone.fromNumber;

  app.get('/health', async () => ({ ok: true, liveCallingEnabled: config.liveCallingEnabled, providerConfigured: !!deps.provider }));

  // ---- POST /v1/calls -------------------------------------------------------
  app.post('/v1/calls', async (req, reply) => {
    const userId = await verifyUser(req.headers.authorization, config.supabaseJwtSecret);
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
      const row = { id: randomUUID(), userId, idempotencyKey: b.idempotencyKey, toNumber: toNumber ?? '', recipientName: b.recipientName,
        status: 'demo' as const, createdAt: now().toISOString(), mode: 'demo' as const };
      await store.saveCall(row);
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
      status: 'queued', createdAt: now().toISOString(), mode: 'live' };
    await store.saveCall(row); // saved first so a retry with the same key can never dial twice
    try {
      const r = await provider.placeCall({
        toNumber: toNumber!, prompt: buildPrompt(facts), voice: b.voice, language: b.language,
        voiceSpeed: typeof b.voiceSpeed === 'number' ? b.voiceSpeed : undefined,
        maxCallSeconds: config.limits.maxCallSeconds, silenceIntervalSeconds: config.limits.silenceIntervalSeconds,
        silenceMaxCheckins: config.limits.silenceMaxCheckins,
        idempotencyKey: createHash('sha256').update(`${userId}:${b.idempotencyKey}`).digest('hex').slice(0, 64),
      });
      row.providerCallId = r.providerCallId;
      row.status = 'in_progress';
      await store.saveCall(row);
      return reply.code(202).send({ callId: id, status: row.status, mode: 'live' });
    } catch (e) {
      row.status = 'failed';
      row.endReason = e instanceof ProviderError ? (e.code ?? 'provider_error') : 'provider_error';
      await store.saveCall(row);
      const retryable = e instanceof ProviderError && e.retryable;
      return reply.code(retryable ? 503 : 502).send({ code: row.endReason, message: e instanceof Error ? e.message : 'Provider error', retryable });
    }
  });

  // ---- GET /v1/calls/:id (live state comes from the provider) ----------------
  app.get('/v1/calls/:id', async (req, reply) => {
    const userId = await verifyUser(req.headers.authorization, config.supabaseJwtSecret);
    if (!userId) return reply.code(401).send({ code: 'unauthorized' });
    const row = await store.findCall(userId, (req.params as any).id);
    if (!row) return reply.code(404).send({ code: 'not_found' });
    if (row.mode === 'live' && row.providerCallId && deps.provider && row.status !== 'completed' && row.status !== 'failed') {
      try {
        const pc = await deps.provider.getCall(row.providerCallId);
        row.status = pc.status; row.endReason = pc.endReason; row.durationSeconds = pc.durationSeconds;
        await store.saveCall(row);
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
      if (evt.event_id && (await store.seenEvent(evt.event_id))) return reply.code(200).send({ ok: true, duplicate: true });

      if (evt.type === 'telephony.complete' && evt.data?.call_id !== undefined) {
        const row = await store.findCallByProviderId(String(evt.data.call_id));
        if (row) {
          row.status = evt.data.status === 'failed' ? 'failed' : 'completed';
          row.endReason = evt.data.end_reason; row.durationSeconds = evt.data.duration_seconds ?? null;
          await store.saveCall(row);
          // Mirror provider-side opt-outs ("don't call me again") into our own suppression list.
          if (deps.provider && row.toNumber) {
            try { if (await deps.provider.isOptedOut(row.toNumber)) await store.addOptOut(row.toNumber); } catch { /* retried on next event */ }
          }
        }
      }
      return reply.code(200).send({ ok: true });
    });
  });

  return app;
}

// ---- entrypoint ---------------------------------------------------------------
if (process.argv[1] && /server\.(ts|js)$/.test(process.argv[1])) {
  if (defaultConfig.liveCallingEnabled) {
    // Opt-outs and call records must survive restarts before any real call is allowed.
    throw new Error('LIVE_CALLING_ENABLED=true requires the Supabase-backed store, which is not implemented yet. Keep it false.');
  }
  const t = defaultConfig.thunderphone;
  const provider = t.apiKey ? new ThunderPhoneProvider({ apiKey: t.apiKey, baseUrl: t.baseUrl, fromNumber: t.fromNumber, agentId: t.agentId }) : undefined;
  buildServer({ config: defaultConfig, store: new MemoryStore(), provider })
    .listen({ port: defaultConfig.port, host: '0.0.0.0' })
    .then(() => console.log(`CallMitra backend on :${defaultConfig.port} (live calling ${defaultConfig.liveCallingEnabled ? 'ON' : 'OFF'})`));
}
