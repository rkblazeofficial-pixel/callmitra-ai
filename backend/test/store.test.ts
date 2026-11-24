import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { PgStore } from '../src/pg-store';
import { CallRow, MemoryStore, Store } from '../src/store';

const U1 = '11111111-1111-1111-1111-111111111111';
const U2 = '22222222-2222-2222-2222-222222222222';
const row = (over: Partial<CallRow> = {}): CallRow => ({
  id: crypto.randomUUID(), userId: U1, idempotencyKey: 'key-00000001', toNumber: '+919876543210', recipientName: 'Rahul',
  language: 'hi', voiceId: 'rohan', occasionId: 'birthday', status: 'queued', createdAt: new Date().toISOString(), mode: 'live', ...over,
});

async function pg() {
  const db = new PGlite();
  await db.exec(`create role authenticated; create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;`);
  for (const f of ['0001_init.sql', '0002_store_support.sql']) await db.exec(readFileSync(new URL(`../../supabase/migrations/${f}`, import.meta.url), 'utf8'));
  await db.exec(`insert into auth.users values ('${U1}'),('${U2}')`);
  return new PgStore(db);
}

// The same behavior must hold for the in-memory store and the durable Postgres store.
describe.each([['MemoryStore', async () => new MemoryStore() as Store], ['PgStore (real SQL via PGlite)', pg as () => Promise<Store>]])('%s', (_n, make) => {
  let s: Store;
  beforeEach(async () => { s = await make(); });

  it('creates once per (user, idempotency key); the duplicate is refused atomically', async () => {
    expect(await s.createCall(row())).toBe(true);
    expect(await s.createCall(row())).toBe(false);
    expect(await s.createCall(row({ userId: U2 }))).toBe(true); // another user may reuse the key
  });
  it('survives a concurrent burst: exactly one winner', async () => {
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => s.createCall(row())));
    expect(results.filter(Boolean)).toHaveLength(1);
  });
  it('finds calls by key, id and provider id, scoped to the user', async () => {
    const r = row({ providerCallId: '77', status: 'in_progress' });
    await s.createCall(r);
    expect((await s.findCallByKey(U1, r.idempotencyKey))?.id).toBe(r.id);
    expect((await s.findCall(U1, r.id))?.recipientName).toBe('Rahul');
    expect(await s.findCall(U2, r.id)).toBeUndefined();
    expect((await s.findCallByProviderId('77'))?.id).toBe(r.id);
    expect(await s.findCallByProviderId('nope')).toBeUndefined();
  });
  it('updates state and keeps the other fields', async () => {
    const r = row(); await s.createCall(r);
    await s.updateCall({ ...r, status: 'completed', endReason: 'user_hangup', durationSeconds: 41, providerCallId: '5' });
    expect(await s.findCall(U1, r.id)).toMatchObject({ status: 'completed', endReason: 'user_hangup', durationSeconds: 41, language: 'hi', voiceId: 'rohan', occasionId: 'birthday' });
  });
  it('counts only live calls inside the window', async () => {
    const old = new Date(Date.now() - 48 * 3600e3).toISOString();
    await s.createCall(row({ idempotencyKey: 'key-0000000a' }));
    await s.createCall(row({ idempotencyKey: 'key-0000000b', createdAt: old }));
    await s.createCall(row({ idempotencyKey: 'key-0000000c', mode: 'demo', status: 'demo' }));
    expect(await s.countCallsSince(U1, new Date(Date.now() - 24 * 3600e3))).toBe(1);
    expect(await s.countCallsSince(U2, new Date(Date.now() - 24 * 3600e3))).toBe(0);
  });
  it('opt-outs are global: one user’s recipient request blocks every user', async () => {
    expect(await s.isOptedOut('+919876543210')).toBe(false);
    await s.addOptOut('+919876543210', U1);
    await s.addOptOut('+919876543210', U1); // idempotent
    expect(await s.isOptedOut('+919876543210')).toBe(true);
    expect(await s.isOptedOut('+919800000000')).toBe(false);
  });
  it('webhook events: unknown until recorded, recording twice is harmless', async () => {
    expect(await s.hasEvent('e1')).toBe(false);
    await s.recordEvent('e1'); await s.recordEvent('e1');
    expect(await s.hasEvent('e1')).toBe(true);
  });
});

describe('PgStore specifics', () => {
  it('requires a user id to record an opt-out', async () => {
    await expect((await pg()).addOptOut('+919876543210')).rejects.toThrow();
  });
});
