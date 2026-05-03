-- Auth + team membership: a workspace can have multiple Supabase auth users.
-- The Slack-OAuth installer becomes 'admin'. Others are added via share-link
-- invites (members) and have read-only access.

alter table workspaces
  add column if not exists owner_user_id uuid references auth.users on delete set null,
  add column if not exists plan text default 'team' check (plan in ('personal','team'));

create table if not exists workspace_members (
  workspace_id uuid references workspaces on delete cascade,
  user_id uuid references auth.users on delete cascade,
  role text not null default 'member' check (role in ('admin','member')),
  invited_by uuid references auth.users,
  created_at timestamptz default now(),
  primary key (workspace_id, user_id)
);
create index if not exists workspace_members_user_idx on workspace_members(user_id);

alter table workspace_members enable row level security;
-- Authenticated user can see their own memberships:
create policy "members read own"
  on workspace_members for select
  using (auth.uid() = user_id);

-- Share-link invites: a token grants automatic 'member' access on first use.
create table if not exists workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces on delete cascade,
  token text unique not null,
  invited_by uuid references auth.users,
  email text,                        -- optional, for email-targeted invites later
  status text default 'active' check (status in ('active','revoked','expired')),
  expires_at timestamptz,
  uses_count int default 0,
  max_uses int default 100,
  created_at timestamptz default now()
);
create index if not exists workspace_invites_workspace_idx on workspace_invites(workspace_id);
create index if not exists workspace_invites_token_idx on workspace_invites(token);

alter table workspace_invites enable row level security;
create policy "service-only-invites" on workspace_invites for all using (false) with check (false);
