-- Allow marking people as "former" (left the company) without deleting them.
-- Useful for: people who are still in Slack but no longer active employees,
-- contractors that finished an engagement, etc.

alter table people drop constraint if exists people_status_check;
alter table people add constraint people_status_check
  check (status in ('draft','active','superseded','former'));
