-- Per-channel mining control: instead of auto-mining everything during backfill,
-- the user enables mining channel-by-channel via the UI. Lets customers control
-- privacy + cost (each enabled channel = LLM calls).

alter table channels
  add column if not exists mining_enabled boolean default false,
  add column if not exists mining_status text default 'idle'
    check (mining_status in ('idle','queued','running','done','failed')),
  add column if not exists mining_last_run_at timestamptz,
  add column if not exists mining_error text;

create index if not exists channels_mining_enabled_idx on channels(workspace_id, mining_enabled) where mining_enabled = true;
