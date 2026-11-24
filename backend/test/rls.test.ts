import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';

// Runs the real migration in an in-process Postgres and proves user isolation.
const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
let db: PGlite;

async function as(uid: string, sql: string, params: any[] = []) {
  await db.exec(`set role authenticated; select set_config('app.uid','${uid}',false);`);
  try { return await db.query(sql, params); } finally { await db.exec('reset role;'); }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role authenticated; create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
    grant usage on schema auth to authenticated; grant usage on schema public to authenticated;
  `);
  for (const f of ['0001_init.sql', '0002_store_support.sql'])
    await db.exec(readFileSync(new URL(`../../supabase/migrations/${f}`, import.meta.url), 'utf8'));
  await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated;
                 grant usage, select on all sequences in schema public to authenticated;
                 insert into auth.users values ('${A}'),('${B}');`);
});

describe('RLS user isolation', () => {
  it('lets a user create and read their own contact', async () => {
    await as(A, `insert into contacts (user_id,name,phone_e164) values ('${A}','Rahul','+919876543210')`);
    expect((await as(A, 'select * from contacts')).rows).toHaveLength(1);
  });
  it('hides one user’s contacts from another', async () => {
    expect((await as(B, 'select * from contacts')).rows).toHaveLength(0);
  });
  it('blocks writing a row as someone else', async () => {
    await expect(as(B, `insert into contacts (user_id,name,phone_e164) values ('${A}','X','+919800000000')`)).rejects.toThrow();
  });
  it('blocks updating or deleting another user’s row', async () => {
    await as(B, `update contacts set name='hacked'`); await as(B, 'delete from contacts');
    expect((await as(A, 'select name from contacts')).rows).toEqual([{ name: 'Rahul' }]);
  });
  it('prevents duplicate numbers per user', async () => {
    await expect(as(A, `insert into contacts (user_id,name,phone_e164) values ('${A}','Dup','+919876543210')`)).rejects.toThrow();
  });
  it('rejects malformed phone numbers', async () => {
    await expect(as(A, `insert into contacts (user_id,name,phone_e164) values ('${A}','Bad','12345')`)).rejects.toThrow();
  });
  it('lets users read but never write calls', async () => {
    await db.exec(`insert into calls (user_id,to_number,language,voice_id,mode,status,idempotency_key) values ('${A}','+919876543210','hi','rohan','demo','demo','k1')`);
    expect((await as(A, 'select * from call_history')).rows).toHaveLength(1);
    expect((await as(B, 'select * from call_history')).rows).toHaveLength(0);
    await expect(as(A, `insert into calls (user_id,to_number,language,voice_id,mode,status,idempotency_key) values ('${A}','+919876543210','hi','rohan','live','completed','k2')`)).rejects.toThrow();
  });
  it('blocks duplicate calls with the same idempotency key', async () => {
    await expect(db.exec(`insert into calls (user_id,to_number,language,voice_id,mode,status,idempotency_key) values ('${A}','+919876543210','hi','rohan','demo','demo','k1')`)).rejects.toThrow();
  });
  it('keeps provider configs and audit logs private', async () => {
    await db.exec(`insert into provider_configs (provider) values ('thunderphone'); insert into audit_logs (action) values ('x');`);
    expect((await as(A, 'select * from provider_configs')).rows).toHaveLength(0);
    expect((await as(A, 'select * from audit_logs')).rows).toHaveLength(0);
  });
  it('keeps opt-outs private per user but lets the owner manage them', async () => {
    await as(A, `insert into suppression_list (user_id,phone_e164) values ('${A}','+919876543210')`);
    expect((await as(B, 'select * from suppression_list')).rows).toHaveLength(0);
  });
  it('keeps webhook_events private', async () => {
    await db.exec(`insert into webhook_events (event_id) values ('e1')`);
    expect((await as(A, 'select * from webhook_events')).rows).toHaveLength(0);
  });
  it('lets everyone read reference data', async () => {
    expect((await as(B, 'select * from occasions')).rows.length).toBe(11);
  });
});
