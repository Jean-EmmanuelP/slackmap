-- Slack team icon: shown in the workspace sidebar so customers see THEIR logo,
-- not the Slackmap brand mark. Pulled from team.info during OAuth.

alter table workspaces
  add column if not exists slack_team_icon_url text;
