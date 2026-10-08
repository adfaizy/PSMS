-- Public bucket for student / staff photos (data URLs migrated by the app)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos',
  'photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Temporary open policies (match current anon-key app auth). Tighten later with Supabase Auth.
drop policy if exists "photos_public_read" on storage.objects;
create policy "photos_public_read"
  on storage.objects for select
  using (bucket_id = 'photos');

drop policy if exists "photos_anon_insert" on storage.objects;
create policy "photos_anon_insert"
  on storage.objects for insert
  with check (bucket_id = 'photos');

drop policy if exists "photos_anon_update" on storage.objects;
create policy "photos_anon_update"
  on storage.objects for update
  using (bucket_id = 'photos')
  with check (bucket_id = 'photos');

drop policy if exists "photos_anon_delete" on storage.objects;
create policy "photos_anon_delete"
  on storage.objects for delete
  using (bucket_id = 'photos');
