// All configuration comes from environment variables. Nothing here is a secret default.
const bool = (v: string | undefined, d = false) => (v === undefined ? d : v === 'true' || v === '1');

export const config = {
  port: Number(process.env.PORT ?? 8080),
  // Live calling stays OFF until you flip this on purpose.
  liveCallingEnabled: bool(process.env.LIVE_CALLING_ENABLED, false),
  supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET ?? '',
  thunderphone: {
    apiKey: process.env.THUNDERPHONE_API_KEY ?? '',
    baseUrl: process.env.THUNDERPHONE_BASE_URL ?? 'https://api.thunderphone.com',
    fromNumber: process.env.THUNDERPHONE_FROM_NUMBER ?? '',
    webhookSecret: process.env.THUNDERPHONE_WEBHOOK_SECRET ?? '',
    agentId: process.env.THUNDERPHONE_AGENT_ID ? Number(process.env.THUNDERPHONE_AGENT_ID) : undefined,
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
