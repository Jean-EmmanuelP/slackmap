-- Linkup integration: per-workspace API key + resolved company context.
-- The wizard (4 steps: website / description / audience / tools) writes here.
-- Every downstream extractor reads these columns to inject grounded context
-- into LLM prompts.

alter table workspaces
  add column if not exists encrypted_linkup_api_key text,
  add column if not exists linkup_key_set_at timestamptz,
  add column if not exists company_name text,
  add column if not exists company_website text,
  add column if not exists company_description text,
  add column if not exists company_industry text,
  add column if not exists company_audience text
    check (company_audience is null or company_audience in ('b2b', 'b2c', 'both')),
  add column if not exists company_tools text[],
  add column if not exists company_context jsonb,
  add column if not exists company_resolved_at timestamptz;
