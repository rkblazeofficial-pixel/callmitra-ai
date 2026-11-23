// Storage abstraction. The in-memory version is for development and tests; the
// Supabase-backed version (supabase/migrations) replaces it before launch.
export type CallRow = {
  id: string; userId: string; idempotencyKey: string; toNumber: string; recipientName: string;
  providerCallId?: string; status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'demo';
  endReason?: string; durationSeconds?: number | null; createdAt: string; mode: 'live' | 'demo';
};
export interface Store {
  findCallByKey(userId: string, key: string): Promise<CallRow | undefined>;
  findCall(userId: string, id: string): Promise<CallRow | undefined>;
  findCallByProviderId(providerCallId: string): Promise<CallRow | undefined>;
  saveCall(row: CallRow): Promise<void>;
  countCallsSince(userId: string, since: Date): Promise<number>;
  isOptedOut(toNumber: string): Promise<boolean>;
  addOptOut(toNumber: string): Promise<void>;
  seenEvent(eventId: string): Promise<boolean>; // returns true if already processed; records it otherwise
}

export class MemoryStore implements Store {
  calls = new Map<string, CallRow>();
  optOuts = new Set<string>();
  events = new Set<string>();
  async findCallByKey(userId: string, key: string) { return [...this.calls.values()].find((c) => c.userId === userId && c.idempotencyKey === key); }
  async findCall(userId: string, id: string) { const c = this.calls.get(id); return c && c.userId === userId ? c : undefined; }
  async findCallByProviderId(pid: string) { return [...this.calls.values()].find((c) => c.providerCallId === pid); }
  async saveCall(row: CallRow) { this.calls.set(row.id, row); }
  async countCallsSince(userId: string, since: Date) {
    return [...this.calls.values()].filter((c) => c.userId === userId && c.mode === 'live' && new Date(c.createdAt) >= since).length;
  }
  async isOptedOut(n: string) { return this.optOuts.has(n); }
  async addOptOut(n: string) { this.optOuts.add(n); }
  async seenEvent(id: string) { if (this.events.has(id)) return true; this.events.add(id); return false; }
}
