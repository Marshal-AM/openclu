-- Per-device orchestrator tunnel (ngrok URL from register.sh)
-- Run in Supabase SQL editor after initial schema.sql

alter table public.devices
  add column if not exists orchestrator_url text;

alter table public.device_registration_pending
  add column if not exists orchestrator_url text;

comment on column public.devices.orchestrator_url is
  'Public HTTPS URL (e.g. ngrok) where this device''s local orchestrator is reachable';

create index if not exists devices_orchestrator_url_idx
  on public.devices (orchestrator_url)
  where orchestrator_url is not null;
