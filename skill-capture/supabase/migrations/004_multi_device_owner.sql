-- Multi-device ownership model
-- 1) Create owner users table keyed by wallet address
-- 2) Backfill owner users from existing devices
-- 3) Make devices.owner_wallet_address required + foreign keyed to users

create table if not exists public.users (
  wallet_address text primary key,
  display_name text,
  email text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz,
  constraint users_wallet_lowercase check (wallet_address ~ '^0x[a-fA-F0-9]{40}$')
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

insert into public.users (wallet_address)
select distinct lower(coalesce(owner_wallet_address, wallet_address))
from public.devices
where coalesce(owner_wallet_address, wallet_address) is not null
on conflict (wallet_address) do nothing;

update public.devices
set owner_wallet_address = lower(coalesce(owner_wallet_address, wallet_address))
where owner_wallet_address is null
   or owner_wallet_address <> lower(owner_wallet_address);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'devices_owner_wallet_address_fkey'
      and conrelid = 'public.devices'::regclass
  ) then
    alter table public.devices
      add constraint devices_owner_wallet_address_fkey
      foreign key (owner_wallet_address)
      references public.users(wallet_address)
      on update cascade
      on delete restrict;
  end if;
end $$;

alter table public.devices
  alter column owner_wallet_address set not null;

create index if not exists users_wallet_lower_idx
  on public.users (lower(wallet_address));

alter table public.users enable row level security;
