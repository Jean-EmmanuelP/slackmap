-- Bilingual brain: English stays canonical (universal, dedup-friendly,
-- LLM-native), and each team can opt into a second display language used
-- across the UI. Translations are cached per-row in a JSONB column so the
-- toggle is instant and doesn't require re-calling the LLM on every render.

alter table workspaces
  add column if not exists display_language text not null default 'en'
    check (length(display_language) between 2 and 8);

-- Backfill: workspaces whose country resolves to a single locale get it as
-- the new default. Cheap heuristic — covers FR, DE, ES, IT, NL, PT, BR.
update workspaces
set display_language = case lower(company_country)
  when 'fr' then 'fr'
  when 'de' then 'de'
  when 'es' then 'es'
  when 'it' then 'it'
  when 'nl' then 'nl'
  when 'pt' then 'pt'
  when 'br' then 'pt'
  else display_language
end
where display_language = 'en' and company_country is not null;

-- Per-row translations cache. Shape:
--   { "fr": { "title": "...", "summary": "...", "trigger": "...", "steps_md": "..." },
--     "de": { ... } }
-- Read pattern: displayed = row.translations[lang][field] ?? row[field] (fallback to English)
alter table skills
  add column if not exists translations jsonb not null default '{}'::jsonb;
alter table glossary_entries
  add column if not exists translations jsonb not null default '{}'::jsonb;
alter table people
  add column if not exists translations jsonb not null default '{}'::jsonb;
