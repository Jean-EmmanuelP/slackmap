-- Multi-source: Freshdesk as a second knowledge source.
-- Skills + glossary now track which tool they were extracted from.

alter table workspaces
  add column if not exists encrypted_freshdesk_api_key text,
  add column if not exists freshdesk_domain text,
  add column if not exists freshdesk_connected_at timestamptz,
  add column if not exists freshdesk_status text default 'idle'
    check (freshdesk_status in ('idle','queued','running','done','failed')),
  add column if not exists freshdesk_error text;

alter table skills
  add column if not exists source text default 'slack'
    check (source in ('slack','freshdesk'));
create index if not exists skills_source_idx on skills(workspace_id, source);

alter table glossary_entries
  add column if not exists source text default 'slack'
    check (source in ('slack','freshdesk'));
create index if not exists glossary_source_idx on glossary_entries(workspace_id, source);
