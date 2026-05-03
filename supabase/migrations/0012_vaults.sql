-- Vaults: per-workspace folders of operational knowledge (credentials, account
-- URLs, environment hints) that the company brain skills reference when an AI
-- agent actually needs to execute a procedure.

create table if not exists vaults (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces on delete cascade,
  name text not null,                    -- "Engineering credentials", "Shopify ops"
  description text,
  visibility text default 'team' check (visibility in ('team','private')),
  created_by uuid references auth.users,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (workspace_id, name)
);
create index if not exists vaults_workspace_idx on vaults(workspace_id);

create table if not exists vault_entries (
  id uuid primary key default gen_random_uuid(),
  vault_id uuid references vaults on delete cascade,
  workspace_id uuid references workspaces on delete cascade,
  kind text not null check (kind in ('password','account','api_key','url','note','other')),
  label text not null,                   -- "Stripe Dashboard (prod)"
  username text,                          -- plaintext metadata: handle / email / "n/a"
  url text,                               -- plaintext: where to use the credential
  encrypted_secret text,                  -- AES-GCM encrypted, optional (e.g. URL entries don't need)
  notes text,                             -- plaintext context for the AI agent
  metadata jsonb default '{}'::jsonb,
  created_by uuid references auth.users,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists vault_entries_vault_idx on vault_entries(vault_id);
create index if not exists vault_entries_workspace_idx on vault_entries(workspace_id);

-- Per-vault ACL: who on the team can read/write each vault.
-- For 'team' visibility, all workspace_members can read. For 'private',
-- only members in this table.
create table if not exists vault_access (
  vault_id uuid references vaults on delete cascade,
  user_id uuid references auth.users on delete cascade,
  role text not null default 'read' check (role in ('read','write','admin')),
  granted_by uuid references auth.users,
  created_at timestamptz default now(),
  primary key (vault_id, user_id)
);

alter table vaults enable row level security;
alter table vault_entries enable row level security;
alter table vault_access enable row level security;
create policy "service-only-vaults" on vaults for all using (false) with check (false);
create policy "service-only-vault-entries" on vault_entries for all using (false) with check (false);
create policy "service-only-vault-access" on vault_access for all using (false) with check (false);
