-- Runbook OS Audit infrastructure.
--
-- The product narrative: a customer plugs ONE thing (API URL + token,
-- DB connection string, or admin URL + session) and the agent runs an
-- audit that produces a ranked list of endpoints their dev team should
-- build to automate their support queue. Once those endpoints exist
-- and get registered, the agent uses them as tools.
--
-- Three tables:
--   data_sources       : the connection a workspace plugged in
--   audit_runs         : each audit produced (timestamp + report jsonb)
--   customer_endpoints : the ranked endpoints proposed by the audit;
--                        marked implemented → active by the customer's
--                        dev team; once active, they show up in the
--                        agent's tool catalog dynamically.

create table if not exists data_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  -- "api" = a REST API base URL the customer exposes
  -- "database" = a read-only DB connection string (MySQL / Postgres)
  -- "admin" = a web admin URL with a session token (least preferred)
  kind text not null check (kind in ('api', 'database', 'admin')),
  label text not null,
  base_url text,
  encrypted_credential text,
  -- Free-form metadata the agent stores about the source: discovered
  -- schema, version, capabilities, etc. Lets the audit re-use prior
  -- discovery without re-scanning the world every time.
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'connected' check (
    status in ('connected', 'scanning', 'scanned', 'failed', 'revoked')
  ),
  last_scan_at timestamptz,
  last_scan_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists data_sources_workspace_idx
  on data_sources (workspace_id, created_at desc);

create table if not exists audit_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  data_source_id uuid references data_sources(id) on delete set null,
  -- The full audit report as structured JSON. Schema enforced
  -- application-side via Zod. Includes: tickets_analyzed_count,
  -- coverage_current_pct, coverage_target_pct, ranked endpoint
  -- proposals, gaps, recommendations.
  report jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (
    status in ('pending', 'running', 'complete', 'failed')
  ),
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists audit_runs_workspace_idx
  on audit_runs (workspace_id, created_at desc);

-- The endpoints the audit recommends. Status transitions:
--   proposed   → audit suggested it, customer hasn't acted
--   implemented → customer's dev team built it, slackmap can call
--   active     → in production, agent uses it in action plans
--   deprecated → customer removed it
create table if not exists customer_endpoints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  source_audit_run_id uuid references audit_runs(id) on delete set null,
  name text not null,
  description text not null,
  -- Why this endpoint matters — tied to ticket patterns from the audit
  -- ("89 tickets in last 90 days asked about subscription status").
  why text not null,
  method text not null default 'GET' check (
    method in ('GET', 'POST', 'PUT', 'DELETE', 'PATCH')
  ),
  url_template text not null,
  request_schema jsonb not null default '{}'::jsonb,
  response_schema jsonb not null default '{}'::jsonb,
  auth_hint text,
  estimated_ticket_coverage integer default 0,
  estimated_ticket_coverage_pct numeric(5,2) default 0,
  status text not null default 'proposed' check (
    status in ('proposed', 'implemented', 'active', 'deprecated')
  ),
  -- Where the agent can find the actual endpoint once active.
  live_base_url text,
  encrypted_auth_token text,
  created_at timestamptz not null default now(),
  marked_implemented_at timestamptz,
  marked_active_at timestamptz
);

create index if not exists customer_endpoints_workspace_status_idx
  on customer_endpoints (workspace_id, status, estimated_ticket_coverage desc);

create unique index if not exists customer_endpoints_unique_per_workspace
  on customer_endpoints (workspace_id, lower(name));
