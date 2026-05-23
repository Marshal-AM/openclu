-- Run in Supabase SQL editor (service role used from Next.js / orchestrator only)

create table if not exists public.users (
  wallet_address text primary key,
  display_name text,
  email text,
  bio text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz,
  constraint users_wallet_lowercase check (wallet_address ~ '^0x[a-fA-F0-9]{40}$')
);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  device_id text not null unique,
  device_name text not null,
  wallet_address text not null unique,
  owner_wallet_address text not null references public.users(wallet_address) on update cascade on delete restrict,
  registration_token text unique,
  registered_at timestamptz,
  orchestrator_url text,
  created_at timestamptz not null default now(),
  constraint devices_wallet_lowercase check (wallet_address ~ '^0x[a-fA-F0-9]{40}$')
);

create index if not exists devices_owner_wallet_idx
  on public.devices (lower(owner_wallet_address));

create table if not exists public.device_registration_pending (
  registration_token text primary key,
  device_id text not null,
  device_name text not null,
  wallet_address text not null unique,
  orchestrator_url text,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now()
);

create table if not exists public.skill_contributions (
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

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_updated_at on public.users;
create trigger users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists skill_contributions_updated_at on public.skill_contributions;
create trigger skill_contributions_updated_at
  before update on public.skill_contributions
  for each row execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.devices enable row level security;
alter table public.device_registration_pending enable row level security;
alter table public.skill_contributions enable row level security;
