-- Support for the backend's durable store.
alter table calls add column recipient_name text;

-- Global opt-out lookups ("has anyone's recipient asked not to be called?").
create index suppression_phone on suppression_list (phone_e164);

-- Webhook de-duplication, recorded only after an event was fully processed.
create table webhook_events (
  event_id text primary key,
  received_at timestamptz not null default now()
);
alter table webhook_events enable row level security;   -- no policies: service role only
