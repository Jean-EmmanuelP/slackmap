-- Freshdesk early-warning system. The brain doesn't just extract knowledge
-- — it watches the support queue and flags weak signals (user complaints,
-- new bug patterns, intent spikes) so the dev/ops team can react before
-- problems escalate. This is phase 1 of replacing the service progressively:
-- observe + alert today, draft replies tomorrow, auto-send when confidence
-- crosses the threshold.

create table if not exists freshdesk_signals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  ticket_id bigint not null,
  ticket_subject text not null,
  ticket_url text,
  urgency text not null check (urgency in ('low', 'medium', 'high', 'critical')),
  category text not null check (
    category in (
      'complaint',         -- explicit dissatisfaction
      'bug',               -- defect / regression report
      'unknown_intent',    -- doesn't match any extracted skill
      'sentiment_negative',-- frustrated / aggressive language
      'spike',             -- topic appearing more than usual
      'churn_risk',        -- mentions cancellation / refund
      'other'
    )
  ),
  reason text not null,
  matched_skill_slug text,
  matched_skill_confidence numeric, -- 0..1, how well the matched skill applies
  status text not null default 'new' check (
    status in ('new', 'acknowledged', 'resolved', 'dismissed')
  ),
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  created_at timestamptz not null default now(),
  unique(workspace_id, ticket_id)
);

create index if not exists freshdesk_signals_workspace_status_idx
  on freshdesk_signals(workspace_id, status, created_at desc);

create index if not exists freshdesk_signals_urgency_idx
  on freshdesk_signals(workspace_id, urgency)
  where status = 'new';
