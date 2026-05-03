-- Slack reorganization recommendations: AI suggestions for renaming, splitting,
-- merging, archiving, or creating channels, based on observed patterns.
-- Customer reviews each rec and accepts or dismisses.

create table if not exists recommendations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces on delete cascade,

  type text not null check (type in (
    'rename_channel',
    'split_channel',
    'merge_channels',
    'archive_channel',
    'create_channel',
    'add_person_to_channel',
    'people_pairing',
    'process_gap'
  )),

  title text not null,                  -- one-line summary
  rationale text,                       -- why this is suggested (multi-paragraph md)
  suggested_action text,                -- concrete action ("rename to X", "split into A and B")

  -- Targets: refs to existing artifacts (channel slack_ids, person slack_user_ids)
  target_channels jsonb default '[]'::jsonb,
  target_people jsonb default '[]'::jsonb,

  citations jsonb default '[]'::jsonb,  -- [{channel_id, ts, snippet}]

  confidence numeric(3,2) default 0.5,
  status text default 'open' check (status in ('open','accepted','dismissed')),

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists recommendations_workspace_idx on recommendations(workspace_id);
create index if not exists recommendations_status_idx on recommendations(workspace_id, status);

alter table recommendations enable row level security;
create policy "service-only-recommendations" on recommendations for all using (false) with check (false);
