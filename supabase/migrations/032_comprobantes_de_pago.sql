-- ============================================================
-- Comprobantes de pago: la foto o el PDF del recibo o voucher de un abono.
--
-- El bucket es privado: un comprobante lleva nombre, documento y monto de un
-- cliente, y no hay motivo para que sea una URL publica. La aplicacion firma
-- una URL corta cada vez que hay que verlo.
--
-- La ruta es <company_id>/pagos/<archivo>, asi la primera carpeta dice a que
-- empresa pertenece y las politicas se resuelven igual que en company-logos.
-- Lo puede ver cualquiera de la empresa; lo sube quien pueda registrar el
-- pago (RLS de payments decide despues si ese abono es suyo); lo cambia o
-- borra quien administra la empresa o quien lo subio.
--
-- payments.voucher, que venia vacio del Excel, guarda la ruta del archivo.
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comprobantes-pago',
  'comprobantes-pago',
  false,
  5242880, -- 5 MB: una foto de celular
  array['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists comprobantes_pago_read on storage.objects;
create policy comprobantes_pago_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'comprobantes-pago'
    and (storage.foldername(name))[1]::uuid in (select my_company_ids())
  );

drop policy if exists comprobantes_pago_insert on storage.objects;
create policy comprobantes_pago_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'comprobantes-pago'
    and (storage.foldername(name))[1]::uuid in (select my_company_ids())
  );

drop policy if exists comprobantes_pago_update on storage.objects;
create policy comprobantes_pago_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'comprobantes-pago'
    and (
      can_manage_company((storage.foldername(name))[1]::uuid)
      or owner_id = (select auth.uid())::text
    )
  );

drop policy if exists comprobantes_pago_delete on storage.objects;
create policy comprobantes_pago_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'comprobantes-pago'
    and (
      can_manage_company((storage.foldername(name))[1]::uuid)
      or owner_id = (select auth.uid())::text
    )
  );

comment on column payments.voucher is
  'Ruta del comprobante en el bucket comprobantes-pago (foto o PDF del recibo).';
