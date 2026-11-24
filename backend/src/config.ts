// All configuration comes from environment variables. Nothing here is a secret default.
const bool = (v: string | undefined, d = false) => (v === undefined ? d : v === 'true' || v === '1');

function parseAgentMap(raw: string | undefined): Record<string, number> {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw);
    return Object.fromEntries(Object.entries(o).filter(([, v]) => Number.isInteger(v))) as Record<string, number>;
  } catch { throw new Error('THUNDERPHONE_AGENT_MAP must be JSON like {"rohan":12}'); }
}

export const config = {
  port: Number(process.env.PORT ?? 8080),
  // Live calling stays OFF until you flip this on purpose.
  liveCallingEnabled: bool(process.env.LIVE_CALLING_ENABLED, false),
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET ?? '',
  databaseUrl: process.env.DATABASE_URL ?? '',
  thunderphone: {
    apiKey: process.env.THUNDERPHONE_API_KEY ?? '',
    baseUrl: process.env.THUNDERPHONE_BASE_URL ?? 'https://api.thunderphone.com',
    fromNumber: process.env.THUNDERPHONE_FROM_NUMBER ?? '',
    webhookSecret: process.env.THUNDERPHONE_WEBHOOK_SECRET ?? '',
    // Saved agents carry the enforced max call duration and the voice. Map each voice id to its agent, e.g. {"rohan":12,"kavita":13}.
    agentId: process.env.THUNDERPHONE_AGENT_ID ? Number(process.env.THUNDERPHONE_AGENT_ID) : undefined,
    agentMap: parseAgentMap(process.env.THUNDERPHONE_AGENT_MAP),
    // Inline per-call config has NO documented max-duration field. Only enable if you accept that risk.
    allowInline: bool(process.env.THUNDERPHONE_ALLOW_INLINE, false),
  },
  limits: {
    maxCallSeconds: Number(process.env.MAX_CALL_SECONDS ?? 300),
    silenceIntervalSeconds: Number(process.env.SILENCE_INTERVAL_SECONDS ?? 15),
    silenceMaxCheckins: Number(process.env.SILENCE_MAX_CHECKINS ?? 2),
    dailyCallsPerUser: Number(process.env.DAILY_CALLS_PER_USER ?? 20),
    // Allowed calling window in the recipient's local time (default India).
    windowStartHour: Number(process.env.CALL_WINDOW_START_HOUR ?? 9),
    windowEndHour: Number(process.env.CALL_WINDOW_END_HOUR ?? 21),
    timezone: process.env.CALL_TIMEZONE ?? 'Asia/Kolkata',
  },
};
export type Config = typeof config;
