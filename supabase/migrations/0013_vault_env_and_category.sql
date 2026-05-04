-- Add env_file kind and category to vaults for company organization.

-- Extend vault_entries.kind to support env_file
ALTER TABLE vault_entries DROP CONSTRAINT vault_entries_kind_check;
ALTER TABLE vault_entries ADD CONSTRAINT vault_entries_kind_check
  CHECK (kind IN ('password','account','api_key','url','note','env_file','other'));

-- Add category column to vaults for grouping by company/project
ALTER TABLE vaults ADD COLUMN IF NOT EXISTS category text;
CREATE INDEX IF NOT EXISTS vaults_category_idx ON vaults(category);
