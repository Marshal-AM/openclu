-- OpenClu catalog (skillListing, trainingDataListing, skillTag, listingVersion → Postgres)
-- Run after schema.sql + 004_multi_device_owner + 005_profile_bucket_and_bio

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- catalog_listings (skillListing + trainingDataListing payloads, 1:1 fields)
-- ---------------------------------------------------------------------------
create table if not exists public.catalog_listings (
  id uuid primary key default gen_random_uuid(),
  content_kind text not null check (content_kind in ('skill', 'trainingData')),
  skill_slug text not null,
  status text not null default 'published'
    check (status in ('draft', 'published', 'archived')),
  owner_wallet text not null,
  creator_wallet text not null,
  version integer not null default 1,
  title text not null,
  description text not null,
  expertise_source text,
  recorded_at timestamptz,
  search_text text not null,
  triggers jsonb not null default '[]'::jsonb,
  trigger_count integer not null default 0,
  tag_cursor boolean not null default false,
  video_mime text,
  -- purchase block (Story/CDR pointers)
  purchase_vault_uuid bigint not null,
  purchase_ip_id text not null,
  purchase_license_terms_id text not null,
  purchase_cid text not null,
  purchase_minting_fee_ip text not null default '1',
  purchase_network text not null default 'aeneid',
  purchase_published_at timestamptz not null,
  purchase_publisher_address text not null,
  -- ops block (json — helia, pinata, story contract addresses)
  ops jsonb not null default '{}'::jsonb,
  -- full payload mirror for API round-trip (skillName, purchase, ops, triggers, etc.)
  payload jsonb not null,
  published_at_ms bigint not null,
  recorded_at_ms bigint not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_listings_owner_wallet_fmt check (owner_wallet ~ '^0x[a-fA-F0-9]{40}$'),
  constraint catalog_listings_creator_wallet_fmt check (creator_wallet ~ '^0x[a-fA-F0-9]{40}$')
);

create unique index if not exists catalog_listings_skill_slug_owner_uidx
  on public.catalog_listings (lower(skill_slug), lower(owner_wallet));

create index if not exists catalog_listings_status_idx
  on public.catalog_listings (status);

create index if not exists catalog_listings_content_kind_idx
  on public.catalog_listings (content_kind);

create index if not exists catalog_listings_owner_wallet_idx
  on public.catalog_listings (lower(owner_wallet));

create index if not exists catalog_listings_creator_wallet_idx
  on public.catalog_listings (lower(creator_wallet));

create index if not exists catalog_listings_published_at_ms_idx
  on public.catalog_listings (published_at_ms desc);

create index if not exists catalog_listings_search_text_trgm_idx
  on public.catalog_listings using gin (search_text gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- catalog_listing_tags (skillTag entities)
-- ---------------------------------------------------------------------------
create table if not exists public.catalog_listing_tags (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.catalog_listings (id) on delete cascade,
  skill_slug text not null,
  tag text not null,
  label text not null,
  created_at timestamptz not null default now(),
  unique (listing_id, tag)
);

create index if not exists catalog_listing_tags_tag_idx
  on public.catalog_listing_tags (lower(tag));

create index if not exists catalog_listing_tags_listing_id_idx
  on public.catalog_listing_tags (listing_id);

-- ---------------------------------------------------------------------------
-- catalog_listing_versions (listingVersion snapshots)
-- ---------------------------------------------------------------------------
create table if not exists public.catalog_listing_versions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.catalog_listings (id) on delete cascade,
  skill_slug text not null,
  version integer not null,
  vault_uuid bigint not null,
  ip_id text not null,
  license_terms_id text not null,
  cid text not null,
  published_at timestamptz not null,
  tx_note text,
  created_at timestamptz not null default now(),
  unique (listing_id, version)
);

create index if not exists catalog_listing_versions_listing_id_idx
  on public.catalog_listing_versions (listing_id);

-- ---------------------------------------------------------------------------
-- skill_contributions (optional job-tracking; aligns with training_data_contributions)
-- ---------------------------------------------------------------------------
create table if not exists public.skill_contributions (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  skill_slug text not null,
  job_id text,
  status text not null default 'draft'
    check (status in ('draft', 'capturing', 'processing', 'distributing', 'published', 'failed', 'archived')),
  catalog_listing_id uuid references public.catalog_listings (id) on delete set null,
  catalog_version integer,
  title text,
  description text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (device_id, skill_slug)
);

drop trigger if exists skill_contributions_updated_at on public.skill_contributions;
create trigger skill_contributions_updated_at
  before update on public.skill_contributions
  for each row execute function public.set_updated_at();

drop trigger if exists catalog_listings_updated_at on public.catalog_listings;
create trigger catalog_listings_updated_at
  before update on public.catalog_listings
  for each row execute function public.set_updated_at();

create table if not exists public.training_data_contributions (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  skill_slug text not null,
  job_id text,
  status text not null default 'draft'
    check (status in ('draft', 'capturing', 'processing', 'distributing', 'published', 'failed', 'archived')),
  catalog_listing_id uuid references public.catalog_listings (id) on delete set null,
  catalog_version integer,
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

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'training_data_contributions' and column_name = 'arkiv_listing_key'
  ) then
    alter table public.training_data_contributions drop column arkiv_listing_key;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'training_data_contributions' and column_name = 'arkiv_version'
  ) then
    alter table public.training_data_contributions drop column arkiv_version;
  end if;
end $$;

alter table public.training_data_contributions enable row level security;
alter table public.skill_contributions enable row level security;
alter table public.catalog_listings enable row level security;
alter table public.catalog_listing_tags enable row level security;
alter table public.catalog_listing_versions enable row level security;

-- Service role (Next.js / orchestrator / marketplace CLI) bypasses RLS via service key.
