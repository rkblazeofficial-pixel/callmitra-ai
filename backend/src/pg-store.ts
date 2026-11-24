import { CallRow, Store } from './store';

// Anything with a pg-style query(): a `pg` Pool in production, PGlite in tests.
export type Queryable = { query: (sql: string, params?: any[]) => Promise<{ rows: any[] }> };

const toRow = (r: any): CallRow => ({
  id: r.id, userId: r.user_id, idempotencyKey: r.idempotency_key, toNumber: r.to_number, recipientName: r.recipient_name ?? '',
  language: r.language, voiceId: r.voice_id, occasionId: r.occasion_id ?? undefined,
  providerCallId: r.provider_call_id ?? undefined, status: r.status, endReason: r.end_reason ?? undefined,
  durationSeconds: r.duration_seconds ?? null, createdAt: new Date(r.created_at).toISOString(), mode: r.mode,
});

// Durable store on the Supabase Postgres database (tables from supabase/migrations).
// Connect with the backend's DATABASE_URL (server-side role; never ship it to the app).
export class PgStore implements Store {
  constructor(private db: Queryable) {}

  private async one(sql: string, params: any[]) { const { rows } = await this.db.query(sql, params); return rows[0] ? toRow(rows[0]) : undefined; }

  findCallByKey(userId: string, key: string) { return this.one('select * from calls where user_id = $1 and idempotency_key = $2', [userId, key]); }
  findCall(userId: string, id: string) { return this.one('select * from calls where user_id = $1 and id = $2', [userId, id]); }
  findCallByProviderId(pid: string) { return this.one("select * from calls where provider = 'thunderphone' and provider_call_id = $1", [pid]); }

  async createCall(r: CallRow) {
    const { rows } = await this.db.query(
      `insert into calls (id,user_id,idempotency_key,to_number,recipient_name,language,voice_id,occasion_id,provider,provider_call_id,
                          status,end_reason,duration_seconds,mode,created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       on conflict (user_id, idempotency_key) do nothing returning id`,
      [r.id, r.userId, r.idempotencyKey, r.toNumber, r.recipientName, r.language, r.voiceId, r.occasionId ?? null,
       r.mode === 'live' ? 'thunderphone' : null, r.providerCallId ?? null, r.status, r.endReason ?? null,
       r.durationSeconds ?? null, r.mode, r.createdAt],
    );
    return rows.length === 1;
  }

  async updateCall(r: CallRow) {
    await this.db.query(
      'update calls set provider_call_id = $2, status = $3, end_reason = $4, duration_seconds = $5, provider = $6 where id = $1',
      [r.id, r.providerCallId ?? null, r.status, r.endReason ?? null, r.durationSeconds ?? null, r.mode === 'live' ? 'thunderphone' : null],
    );
  }

  async countCallsSince(userId: string, since: Date) {
    const { rows } = await this.db.query("select count(*)::int as n from calls where user_id = $1 and mode = 'live' and created_at >= $2", [userId, since.toISOString()]);
    return Number(rows[0].n);
  }

  async isOptedOut(toNumber: string) {
    const { rows } = await this.db.query('select 1 from suppression_list where phone_e164 = $1 limit 1', [toNumber]);
    return rows.length > 0;
  }

  async addOptOut(toNumber: string, userId?: string) {
    if (!userId) throw new Error('addOptOut needs a userId for the durable store');
    await this.db.query('insert into suppression_list (user_id, phone_e164) values ($1,$2) on conflict (user_id, phone_e164) do nothing', [userId, toNumber]);
  }

  async hasEvent(id: string) { return (await this.db.query('select 1 from webhook_events where event_id = $1', [id])).rows.length > 0; }
  async recordEvent(id: string) { await this.db.query('insert into webhook_events (event_id) values ($1) on conflict do nothing', [id]); }
}
