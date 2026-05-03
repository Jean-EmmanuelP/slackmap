-- Skills: procedural knowledge extracted from Slack as agent-consumable artifacts.
-- Each skill represents a recurring procedure, policy, or decision rule observed
-- in conversations. Output format is Claude-skill-compatible markdown.

create table if not exists skills (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces on delete cascade,

  -- type: process (a recurring procedure), policy (a rule), decision (a one-off
  -- decision that becomes precedent), escalation (who-decides-what)
  type text not null check (type in ('process','policy','decision','escalation')),

  slug text not null,                    -- kebab-case identifier (handle-refund)
  title text not null,                   -- "Handle customer refund request"
  trigger text,                          -- "When a customer asks for a refund..."
  steps_md text,                         -- ordered steps in markdown
  decision_criteria text,                -- the if/then logic
  escalation text,                       -- when to escalate, to whom

  -- citations: jsonb array of { channel_id, ts, snippet } pointing to source
  -- threads. The agent quotes these to justify decisions.
  citations jsonb default '[]'::jsonb,

  source_count int default 0,            -- how many distinct threads support this
  confidence numeric(3,2) default 0.5,   -- 0.0–1.0, derived from source_count + recency
  last_observed_at timestamptz,
  first_observed_at timestamptz,

  -- status: draft (LLM extracted, not human-reviewed), active (validated),
  -- superseded (replaced by a newer skill — keep for audit trail)
  status text default 'draft' check (status in ('draft','active','superseded')),
  superseded_by uuid references skills on delete set null,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (workspace_id, slug)
);

create index if not exists skills_workspace_idx on skills(workspace_id);
create index if not exists skills_type_idx on skills(workspace_id, type);
create index if not exists skills_status_idx on skills(workspace_id, status);

alter table skills enable row level security;
create policy "service-only-skills" on skills for all using (false) with check (false);

-- Track which channel→skill extractions have been done so we don't re-process
-- the same channel during incremental updates.
create table if not exists skill_extractions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces on delete cascade,
  channel_id uuid references channels on delete cascade,
  extracted_at timestamptz default now(),
  oldest_msg_ts text,                    -- the earliest message ts processed
  latest_msg_ts text,                    -- the latest message ts processed
  skills_found int default 0,
  unique (workspace_id, channel_id)
);

alter table skill_extractions enable row level security;
create policy "service-only-skill-extractions" on skill_extractions for all using (false) with check (false);
