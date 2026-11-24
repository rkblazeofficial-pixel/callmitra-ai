// Storage abstraction. MemoryStore is for development, demo mode and tests.
// PgStore (pg-store.ts) is the durable Supabase/Postgres implementation required for live calling.
export type CallRow = {
  id: string; userId: string; idempotencyKey: string; toNumber: string; recipientName: string;
  language: string; voiceId: string; occasionId?: string;
  providerCallId?: string; status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'demo';
  endReason?: string; durationSeconds?: number | null; createdAt: string; mode: 'live' | 'demo';
};
export interface Store {
  findCallByKey(userId: string, key: string): Promise<CallRow | undefined>;
  findCall(userId: string, id: string): Promise<CallRow | undefined>;
  findCallByProviderId(providerCallId: string): Promise<CallRow | undefined>;
  /** Atomically inserts. Returns false if (userId, idempotencyKey) already exists, so a duplicate can never dial. */
  createCall(row: CallRow): Promise<boolean>;
  updateCall(row: CallRow): Promise<void>;
  countCallsSince(userId: string, since: Date): Promise<number>;
  /** Global: if anyone's recipient asked not to be called, no user may call that number. */
  isOptedOut(toNumber: string): Promise<boolean>;
  addOptOut(toNumber: string, userId?: string): Promise<void>;
  hasEvent(eventId: string): Promise<boolean>;
  recordEvent(eventId: string): Promise<void>; // call only AFTER the event was fully processed
}

export class MemoryStore implements Store {
  calls = new Map<string, CallRow>();
  optOuts = new Set<string>();
  events = new Set<string>();
  async findCallByKey(userId: string, key: string) { return [...this.calls.values()].find((c) => c.userId === userId && c.idempotencyKey === key); }
  async findCall(userId: string, id: string) { const c = this.calls.get(id); return c && c.userId === userId ? c : undefined; }
  async findCallByProviderId(pid: string) { return [...this.calls.values()].find((c) => c.providerCallId === pid); }
  async createCall(row: CallRow) {
    if ([...this.calls.values()].some((c) => c.userId === row.userId && c.idempotencyKey === row.idempotencyKey)) return false;
    this.calls.set(row.id, row);
    return true;
  }
  async updateCall(row: CallRow) { this.calls.set(row.id, row); }
  async countCallsSince(userId: string, since: Date) {
    return [...this.calls.values()].filter((c) => c.userId === userId && c.mode === 'live' && new Date(c.createdAt) >= since).length;
  }
  async isOptedOut(n: string) { return this.optOuts.has(n); }
  async addOptOut(n: string) { this.optOuts.add(n); }
  async hasEvent(id: string) { return this.events.has(id); }
  async recordEvent(id: string) { this.events.add(id); }
}
