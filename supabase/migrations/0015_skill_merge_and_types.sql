-- Extend skill types: faq (procedural Q&A), runbook (ops technical), procedure (step-by-step without judgment)
alter table skills drop constraint skills_type_check;
alter table skills add constraint skills_type_check check (type in ('process','policy','decision','escalation','faq','runbook','procedure'));

-- Track merged-away skills for audit
alter table skills add column if not exists merged_into uuid references skills on delete set null;
alter table skills add column if not exists merged_reason text;

-- Index for finding draft candidates to merge
create index if not exists skills_draft_merge_idx on skills(workspace_id, status) where status = 'draft';
