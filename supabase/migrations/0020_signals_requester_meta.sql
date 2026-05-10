-- Capture the minimum WHO+WHEN context needed for the brain to reason about
-- patterns over time (which customer cohort is complaining, when did the
-- spike start). Deliberately NOT replicating Freshdesk's inbox UI:
--   - no assignee, no priority text, no status label
--   - just the email + ticket creation timestamp the analyzer saw at scan time
-- Ticket priority is stored as the raw int because we use it for sort/scoring.

alter table freshdesk_signals
  add column if not exists requester_email text,
  add column if not exists ticket_created_at timestamptz,
  add column if not exists ticket_priority int;

create index if not exists freshdesk_signals_ticket_created_idx
  on freshdesk_signals(workspace_id, ticket_created_at desc)
  where status in ('new', 'acknowledged');
