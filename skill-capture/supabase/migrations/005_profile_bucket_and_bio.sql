-- Profile enhancements: free-form bio + avatar storage bucket

alter table public.users
  add column if not exists bio text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read for profile pictures
drop policy if exists "Public read profile avatars" on storage.objects;
create policy "Public read profile avatars"
on storage.objects
for select
using (bucket_id = 'profile-avatars');

-- Upload/update/delete through backend service role only
drop policy if exists "Service role insert profile avatars" on storage.objects;
create policy "Service role insert profile avatars"
on storage.objects
for insert
with check (bucket_id = 'profile-avatars' and auth.role() = 'service_role');

drop policy if exists "Service role update profile avatars" on storage.objects;
create policy "Service role update profile avatars"
on storage.objects
for update
using (bucket_id = 'profile-avatars' and auth.role() = 'service_role')
with check (bucket_id = 'profile-avatars' and auth.role() = 'service_role');

drop policy if exists "Service role delete profile avatars" on storage.objects;
create policy "Service role delete profile avatars"
on storage.objects
for delete
using (bucket_id = 'profile-avatars' and auth.role() = 'service_role');
