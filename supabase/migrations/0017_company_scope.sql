-- Geographic scope of the company (used to bias every Linkup search).
-- Without this, generic names ("BeStrong", "Acme") resolve to the loudest
-- English-language brand — usually a US one — even when the user's actual
-- company is a smaller national one. The wizard asks this in step 1.

alter table workspaces
  add column if not exists company_scope text
    check (company_scope is null or company_scope in ('worldwide', 'national')),
  add column if not exists company_country text; -- ISO 3166-1 alpha-2, e.g. 'FR'
