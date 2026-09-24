-- Public product images live under assets/pos-products/<user-id>/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assets',
  'assets',
  true,
  2097152,
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read POS product images" on storage.objects;
create policy "Public read POS product images"
on storage.objects for select
using (
  bucket_id = 'assets'
  and (storage.foldername(name))[1] = 'pos-products'
);

drop policy if exists "Authenticated upload POS product images" on storage.objects;
create policy "Authenticated upload POS product images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'assets'
  and (storage.foldername(name))[1] = 'pos-products'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "Owners update POS product images" on storage.objects;
create policy "Owners update POS product images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'assets'
  and (storage.foldername(name))[1] = 'pos-products'
)
with check (
  bucket_id = 'assets'
  and (storage.foldername(name))[1] = 'pos-products'
);

drop policy if exists "Owners delete POS product images" on storage.objects;
create policy "Owners delete POS product images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'assets'
  and (storage.foldername(name))[1] = 'pos-products'
);
