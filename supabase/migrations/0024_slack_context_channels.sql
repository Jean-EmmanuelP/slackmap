-- Slack-as-context for the support agent.
--
-- The agent already has access to skills, glossary, company context, and Stripe
-- customer data when drafting replies. The missing piece: live ops/dev/bug
-- discussions happening on Slack. Without these, the agent can't say "fix
-- planned for next deploy" or "known issue, eng team is on it" — it just
-- escalates to needs_human.
--
-- This column lets the workspace nominate one or more Slack channels (by
-- slack_channel_id) whose recent messages will be fetched at draft time and
-- injected into the LLM prompt as "## Recent Slack context".
--
-- Empty array = feature disabled for this workspace, no Slack fetch happens.

alter table workspaces
  add column if not exists slack_context_channel_ids text[] not null default '{}';
