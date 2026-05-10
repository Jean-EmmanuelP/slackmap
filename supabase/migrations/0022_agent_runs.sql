-- Agent runtime: the support co-pilot. For each Freshdesk ticket the agent
-- processes, we record the draft it produced, which skills it grounded the
-- draft on, and the human-in-the-loop outcome (sent unchanged, sent after
-- edits, rejected). The diff between draft_original and draft_sent feeds
-- back into skill confidence — a skill that consistently produces drafts
-- the human sends unchanged is a high-trust skill, and over time we can
-- promote it to auto-send.

create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,

  -- Source ticket
  ticket_id bigint not null,
  ticket_subject text not null,
  ticket_url text,
  ticket_body text,
  requester_email text,
  ticket_priority int,
  ticket_created_at timestamptz,

  -- LLM-derived classification (mirrors freshdesk_signals so the agent runs
  -- against the same triage taxonomy)
  urgency text check (urgency is null or urgency in ('low', 'medium', 'high', 'critical')),
  category text,

  -- Draft
  draft_original text,            -- exactly what the agent produced
  draft_sent text,                -- what the human actually sent (null if rejected)
  reasoning text,                 -- agent's one-paragraph rationale

  -- Skills the draft is grounded on (slugs from the workspace's skill catalog)
  matched_skill_slugs text[] not null default '{}',

  -- Workflow status
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'rejected', 'failed')),
  rejection_reason text,

  -- Feedback metrics computed at send time
  diff_distance numeric,          -- 0..1 normalised Levenshtein over draft_original ⇄ draft_sent
  outcome text                    -- 'sent_unchanged' | 'sent_edited' | 'rejected' | 'failed'
    check (outcome is null or outcome in ('sent_unchanged', 'sent_edited', 'rejected', 'failed')),

  -- Audit
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  sent_at timestamptz,

  unique (workspace_id, ticket_id)
);

create index if not exists agent_runs_workspace_status_idx
  on agent_runs(workspace_id, status, created_at desc);

create index if not exists agent_runs_pending_urgency_idx
  on agent_runs(workspace_id, urgency)
  where status = 'pending';

-- Track the high-water mark per workspace so the cron knows what's new.
alter table workspaces
  add column if not exists last_agent_tick_at timestamptz;
