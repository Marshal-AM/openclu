create table if not exists public.training_data_contributions (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  skill_slug text not null,
  job_id text,
  status text not null default 'draft'
    check (status in ('draft','capturing','processing','distributing','published','failed','archived')),
  arkiv_listing_key text,
  arkiv_version integer,
  title text,
  description text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (device_id, skill_slug)
);

drop trigger if exists training_data_contributions_updated_at on public.training_data_contributions;
create trigger training_data_contributions_updated_at
  before update on public.training_data_contributions
  for each row execute function public.set_updated_at();

alter table public.training_data_contributions enable row level security;
