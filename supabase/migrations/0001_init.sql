-- CallMitra AI initial schema. Users live in Supabase Auth (auth.users).
-- Row Level Security is ON for every table. Users only ever see their own rows.
-- The backend uses the service role key (bypasses RLS) for call state, usage and audit writes.


-- ---------- reference data (read-only for users) ----------
create table occasions (
  id text primary key, label text not null, is_invitation boolean not null default false, sort int not null default 0
);
create table voice_profiles (
  id text primary key,                 -- provider voice id, e.g. 'rohan'
  provider text not null default 'thunderphone',
  display_name text not null,
  gender text not null check (gender in ('female','male')),
  languages text[] not null,
  active boolean not null default true
);

-- ---------- users ----------
create table profiles (
  user_id uuid primary key references auth.users on delete cascade,
  display_name text not null,
  phone text,
  default_language text not null default 'hinglish',
  default_gender text not null default 'female' check (default_gender in ('female','male')),
  default_style text not null default 'Friendly',
  default_speed text not null default 'Normal',
  notifications_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table contact_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null, created_at timestamptz not null default now(),
  unique (user_id, name)
);
create table contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  group_id uuid references contact_groups on delete set null,
  name text not null,
  phone_e164 text not null check (phone_e164 ~ '^\+[0-9]{11,15}$'),
  relation text,
  created_at timestamptz not null default now(),
  unique (user_id, phone_e164)        -- no duplicate numbers per user
);
create table recipient_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  contact_id uuid not null references contacts on delete cascade,
  granted boolean not null,
  source text not null default 'user_attested',
  recorded_at timestamptz not null default now()
);
create table suppression_list (        -- opt-outs: calls to these numbers are always blocked
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  phone_e164 text not null,
  source text not null default 'call_request',
  created_at timestamptz not null default now(),
  unique (user_id, phone_e164)
);

-- ---------- messages ----------
create table message_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,   -- null = built-in
  occasion_id text references occasions,
  title text not null, body text not null, created_at timestamptz not null default now()
);
create table generated_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  occasion_id text references occasions,
  prompt text not null, script text not null,
  facts jsonb not null default '{}', missing text[] not null default '{}',
  is_draft boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- ---------- calling ----------
create table call_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null, message_id uuid references generated_messages,
  created_at timestamptz not null default now()
);
create table call_recipients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  campaign_id uuid references call_campaigns on delete cascade,
  contact_id uuid references contacts on delete set null,
  name text not null, phone_e164 text not null
);
create table calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  campaign_id uuid references call_campaigns,
  recipient_id uuid references call_recipients,
  message_id uuid references generated_messages,
  occasion_id text references occasions,
  to_number text not null,
  language text not null, voice_id text not null,
  mode text not null check (mode in ('live','demo')),
  provider text, provider_call_id text,
  status text not null check (status in ('queued','in_progress','completed','failed','demo')),
  end_reason text, duration_seconds int, outcome text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)    -- duplicate-call protection
);
create index calls_user_created on calls (user_id, created_at desc);
create unique index calls_provider_id on calls (provider, provider_call_id) where provider_call_id is not null;
create table call_events (
  id bigint generated always as identity primary key,
  call_id uuid not null references calls on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  event_id text, type text not null, data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (event_id)                    -- webhook de-duplication
);
create table schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  call_payload jsonb not null,
  run_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','running','done','failed','cancelled')),
  attempts int not null default 0, last_error text,
  created_at timestamptz not null default now()
);

-- ---------- usage, notifications, ops ----------
create table credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  delta_cents int not null, reason text not null, call_id uuid references calls,
  created_at timestamptz not null default now()
);
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null, body text, read boolean not null default false,
  created_at timestamptz not null default now()
);
create table provider_configs (        -- backend only: no policies, so users can never read it
  id uuid primary key default gen_random_uuid(),
  provider text not null unique, enabled boolean not null default false,
  settings jsonb not null default '{}', updated_at timestamptz not null default now()
);
create table audit_logs (              -- backend only
  id bigint generated always as identity primary key,
  user_id uuid, action text not null, detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------- call history view (respects the caller's RLS) ----------
create view call_history with (security_invoker = true) as
  select c.id, c.user_id, c.created_at, c.to_number, c.occasion_id, c.language, c.voice_id,
         c.mode, c.status, c.end_reason, c.duration_seconds, c.outcome
  from calls c;

-- ---------- Row Level Security ----------
alter table occasions enable row level security;
alter table voice_profiles enable row level security;
create policy "read occasions" on occasions for select to authenticated using (true);
create policy "read voices" on voice_profiles for select to authenticated using (active);

-- Tables users may fully manage for themselves.
do $$ declare t text; begin
  foreach t in array array['contact_groups','contacts','recipient_consents','suppression_list','generated_messages',
                           'call_campaigns','call_recipients','schedules'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "own rows" on %I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

alter table profiles enable row level security;
create policy "own profile" on profiles for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table message_templates enable row level security;
create policy "read templates" on message_templates for select to authenticated using (user_id is null or user_id = auth.uid());
create policy "write own templates" on message_templates for insert to authenticated with check (user_id = auth.uid());
create policy "edit own templates" on message_templates for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own templates" on message_templates for delete to authenticated using (user_id = auth.uid());

-- Read-only for users (the backend writes these with the service role).
do $$ declare t text; begin
  foreach t in array array['calls','call_events','credit_ledger'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "read own" on %I for select to authenticated using (user_id = auth.uid())', t);
  end loop;
end $$;
alter table notifications enable row level security;
create policy "read own notifications" on notifications for select to authenticated using (user_id = auth.uid());
create policy "mark own notifications" on notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- No policies = no access for users. Service role only.
alter table provider_configs enable row level security;
alter table audit_logs enable row level security;

-- ---------- seed ----------
insert into occasions (id, label, is_invitation, sort) values
 ('birthday','Birthday',false,1),('wedding','Wedding Invite',true,2),('engagement','Engagement',true,3),
 ('anniversary','Anniversary',false,4),('festival','Festival',false,5),('housewarming','Housewarming',true,6),
 ('baby','Baby Announcement',false,7),('congrats','Congratulations',false,8),('party','Party Invite',true,9),
 ('family','Family Function',true,10),('custom','Custom Message',false,11);
