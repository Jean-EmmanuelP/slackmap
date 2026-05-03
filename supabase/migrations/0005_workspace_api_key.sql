-- BYO Anthropic API key per workspace. Self-hosted instances let each tenant
-- bring their own key — no shared LLM costs for the host. Encrypted at rest
-- with the same crypto as the Slack tokens.

alter table workspaces
  add column if not exists encrypted_anthropic_api_key text,
  add column if not exists anthropic_key_set_at timestamptz;
