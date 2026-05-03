-- Slackmap initial schema: workspaces, channels, glossary, processed_events.
-- Multi-tenant by workspace_id. RLS enforces isolation.

-- Tokens are encrypted application-side via lib/crypto.ts before being stored here.
create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  slack_team_id text unique not null,
  slack_team_name text not null,
  slack_team_domain text,
  encrypted_bot_token text not null,
  encrypted_user_token text,
  installed_by_slack_user_id text not null,
  installed_by_slack_user_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  backfill_status text default 'pending' check (backfill_status in ('pending','running','ready','failed')),
  backfill_progress int default 0,
  backfill_total int default 0,
  backfill_error text,
  last_event_received_at timestamptz
);

create table if not exists channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces on delete cascade,
  slack_channel_id text not null,
  name text not null,
  topic text,
  purpose_native text,
  purpose_extracted text,
  category text,
  message_count_6mo int default 0,
  unique_contributors int default 0,
  last_message_at timestamptz,
  archived boolean default false,
  is_private boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (workspace_id, slack_channel_id)
);
create index if not exists channels_workspace_idx on channels(workspace_id);

create table if not exists glossary_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces on delete cascade,
  term text not null,
  definition text not null,
  category text,
  first_seen_channel_id text,
  first_seen_ts text,
  occurrences int default 1,
  last_seen_at timestamptz default now(),
  created_at timestamptz default now(),
  unique (workspace_id, term)
);
create index if not exists glossary_workspace_idx on glossary_entries(workspace_id);
create index if not exists glossary_term_idx on glossary_entries(workspace_id, term);

-- Idempotency for Slack events. Slack delivers each event_id at most once normally,
-- but retries can re-deliver. We dedupe here.
create table if not exists processed_events (
  event_id text primary key,
  workspace_id uuid references workspaces on delete cascade,
  processed_at timestamptz default now()
);
create index if not exists processed_events_ws_idx on processed_events(workspace_id);

-- Auto-purge old processed_events (>30d) via a scheduled function (see reconcile job).

alter table workspaces enable row level security;
alter table channels enable row level security;
alter table glossary_entries enable row level security;

-- v0 access pattern: only the service role (server-side) reads/writes these tables.
-- The Next.js server uses the service key (bypasses RLS). Public anon access is denied.
create policy "service-only-workspaces" on workspaces for all using (false) with check (false);
create policy "service-only-channels" on channels for all using (false) with check (false);
create policy "service-only-glossary" on glossary_entries for all using (false) with check (false);
