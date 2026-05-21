-- Optional: align with repo schema.sql if your project was created without metadata.
-- Safe to run; skips if columns already exist.

alter table public.skill_contributions
  add column if not exists title text;

alter table public.skill_contributions
  add column if not exists description text;

-- If you prefer jsonb metadata (schema.sql), uncomment:
-- alter table public.skill_contributions add column if not exists metadata jsonb not null default '{}';
