-- Domain category for skills (eng / product / ops / support / sales / leadership / other).
-- Used to group the skills view so it doesn't become an unstructured list as the
-- workspace grows. Inferred by the LLM at extraction time from the owning
-- person's role + tools + channels.

alter table skills add column if not exists domain text;
create index if not exists skills_domain_idx on skills(workspace_id, domain);
