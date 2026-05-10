-- Per-workspace Stripe credential. Paste-key v1 (mirrors anthropic + freshdesk
-- pattern). Stripe Connect OAuth comes when slackmap is multi-tenant; for the
-- BeStrong workflow today, encrypted secret key is sufficient.

alter table workspaces
  add column if not exists encrypted_stripe_api_key text,
  add column if not exists stripe_key_set_at timestamptz,
  add column if not exists stripe_account_id text,        -- acct_... if known
  add column if not exists stripe_livemode boolean;       -- true = sk_live_, false = sk_test_
