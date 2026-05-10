-- Feedback loop for skills: when an installed skill is used by an agent (or
-- modified by a human reviewer), record the signal so we can refine
-- confidence and surface "still valid?" prompts. Closes the brain ⇄ agent
-- loop that was previously a black hole after CLI install.

create table if not exists skill_feedback (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  skill_id uuid not null references skills(id) on delete cascade,
  skill_slug text not null,
  applied boolean not null default true,
  rating int check (rating is null or rating between 1 and 5),
  modification_proposed text,
  context text, -- e.g. "freshdesk-ticket-12345" or "slack-thread-..."
  source text not null default 'agent' check (source in ('agent', 'cli', 'manual')),
  created_at timestamptz not null default now()
);

create index if not exists skill_feedback_skill_idx on skill_feedback(skill_id);
create index if not exists skill_feedback_workspace_idx on skill_feedback(workspace_id, created_at desc);

-- Aggregate counters on skills for fast read-side surfacing.
alter table skills
  add column if not exists applied_count int not null default 0,
  add column if not exists last_applied_at timestamptz,
  add column if not exists last_modification_proposed text;
