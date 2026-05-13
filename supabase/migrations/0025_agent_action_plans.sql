-- Agent Action Plans.
--
-- Until now an agent_run = a single text draft. The reviewer can either
-- send the text or reject it — no notion of "and also refund €29.99, also
-- cancel subscription at period end, also tag the ticket". That collapses
-- the agent's intent into one execution surface and conflates communication
-- with side-effects.
--
-- This migration adds two columns:
--   - proposed_actions   : jsonb array of AgentAction objects the LLM
--                          proposes alongside the draft. Each action has
--                          a tool name, args, reasoning, irreversibility
--                          flag, approval level, and execution status.
--   - applied_actions    : jsonb array of action IDs that the reviewer
--                          actually approved + executed. Used for audit +
--                          to prevent double-execution on page reloads.
--
-- And a customer_facts table for the DB-pillar tool db.record_customer_fact.
-- This is the cross-ticket memory layer — sarah asked for refund 2 weeks
-- ago, today she asks again — without it the agent treats every ticket
-- as if it's the first contact.

alter table agent_runs
  add column if not exists proposed_actions jsonb not null default '[]'::jsonb,
  add column if not exists applied_actions jsonb not null default '[]'::jsonb;

-- Customer memory: facts the agent extracts across tickets, scoped per
-- workspace and per customer email. The source_run_id traces where the
-- fact came from so the reviewer can audit it later.
create table if not exists customer_facts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  customer_email text not null,
  fact text not null,
  tags text[] not null default '{}',
  source_run_id uuid references agent_runs(id) on delete set null,
  source_ticket_id integer,
  created_at timestamptz not null default now(),
  -- Soft-revoke: when a fact becomes outdated the reviewer can mark it as
  -- superseded rather than delete it, preserving the audit trail.
  superseded_at timestamptz,
  superseded_reason text
);

create index if not exists customer_facts_workspace_email_idx
  on customer_facts (workspace_id, customer_email);

create index if not exists customer_facts_recent_idx
  on customer_facts (workspace_id, created_at desc)
  where superseded_at is null;

-- Audit log of actions actually executed. Phase 3 (executor) writes here.
-- Created now so Phase 1 code can reference the table without a later
-- migration shuffle, even though no rows are written yet.
create table if not exists agent_action_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  run_id uuid not null references agent_runs(id) on delete cascade,
  action_id text not null,
  tool text not null,
  args jsonb not null default '{}'::jsonb,
  executed_at timestamptz not null default now(),
  executed_by uuid references auth.users(id),
  result jsonb,
  error text
);

create index if not exists agent_action_log_run_idx
  on agent_action_log (run_id, executed_at desc);
