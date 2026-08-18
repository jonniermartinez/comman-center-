-- ============================================================
-- Logos de las empresas cliente.
--
-- El bucket es publico de lectura a proposito: el logo se pinta en el sidebar
-- y en las tarjetas, y hacerlo privado obligaria a firmar una URL por cada
-- render. No hay nada sensible en un logo. Escribir, en cambio, solo puede
-- quien administra esa empresa.
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-logos',
  'company-logos',
  true,
  2097152, -- 2 MB: es un logo, no una foto
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Los archivos se guardan como <company_id>/<nombre>, asi que la primera
-- carpeta de la ruta dice a que empresa pertenece el archivo.
drop policy if exists company_logos_read on storage.objects;
create policy company_logos_read on storage.objects
  for select using (bucket_id = 'company-logos');

drop policy if exists company_logos_insert on storage.objects;
create policy company_logos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'company-logos'
    and can_manage_company((storage.foldername(name))[1]::uuid)
  );

drop policy if exists company_logos_update on storage.objects;
create policy company_logos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'company-logos'
    and can_manage_company((storage.foldername(name))[1]::uuid)
  );

drop policy if exists company_logos_delete on storage.objects;
create policy company_logos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'company-logos'
    and can_manage_company((storage.foldername(name))[1]::uuid)
  );
