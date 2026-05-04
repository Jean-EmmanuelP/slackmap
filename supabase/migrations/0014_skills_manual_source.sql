-- Add 'manual' source to skills for human-authored entries.

ALTER TABLE skills DROP CONSTRAINT skills_source_check;
ALTER TABLE skills ADD CONSTRAINT skills_source_check
  CHECK (source IN ('slack','freshdesk','manual'));
