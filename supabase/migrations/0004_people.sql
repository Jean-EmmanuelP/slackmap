-- People profiles: AI-generated "fiche" for each Slack user, inferred from
-- their activity. Captures role, tools they use, expertise areas, top channels.
-- Used to know who to ping for what — and as input to Company Brain agents.

create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces on delete cascade,
  slack_user_id text not null,

  -- Slack profile (populated from users.info)
  display_name text,
  real_name text,
  title text,                          -- Slack "What I do"
  email text,
  avatar_url text,
  is_bot boolean default false,
  is_deleted boolean default false,

  -- LLM-extracted profile (the actual "fiche IA")
  role_extracted text,                 -- "Backend Engineer", "Marketing Lead"
  summary text,                        -- 2-3 sentence AI bio
  tools text[] default '{}',           -- ["VS Code", "Linear", "Stripe Dashboard"]
  expertise text[] default '{}',       -- ["Postgres", "iOS billing"]
  top_channels jsonb default '[]'::jsonb,  -- [{channel_id, name, count}]

  -- Activity stats
  message_count int default 0,
  first_seen_at timestamptz,
  last_seen_at timestamptz,

  -- Derived from confidence/recency
  confidence numeric(3,2) default 0.5,
  status text default 'draft' check (status in ('draft','active','superseded','former')),

  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (workspace_id, slack_user_id)
);

create index if not exists people_workspace_idx on people(workspace_id);
create index if not exists people_role_idx on people(workspace_id, role_extracted);

alter table people enable row level security;
create policy "service-only-people" on people for all using (false) with check (false);

-- Activity tracking: rolled up per-(workspace, user, channel) so we can compute
-- "top channels for X" without re-scanning messages every time.
create table if not exists people_activity (
  workspace_id uuid references workspaces on delete cascade,
  slack_user_id text not null,
  slack_channel_id text not null,
  message_count int default 0,
  last_message_ts text,
  updated_at timestamptz default now(),
  primary key (workspace_id, slack_user_id, slack_channel_id)
);

alter table people_activity enable row level security;
create policy "service-only-people-activity" on people_activity for all using (false) with check (false);
