-- ============================================================
-- Command Center · 063 · La casilla también gobierna los pagos
--
-- La 062 dejó la casilla "puede editar" solo sobre las ventas. Corregir un
-- pago seguía abierto a cualquiera de la empresa (025), así que un coordinador
-- sin la casilla igual podía cambiar valor, medio o recibo.
--
-- Desde acá un pago lo corrige:
--   · el super admin;
--   · un coordinador con la casilla encendida en esa empresa;
--   · quien registró la venta a la que pertenece el pago, para arreglar lo
--     suyo en el momento sin esperar a nadie.
--
-- Registrar un pago nuevo no cambia, ni archivarlo (solo super admin, 062).
-- ============================================================
drop policy if exists payments_update on payments;

create policy payments_update on payments
  for update
  using (
    puede_editar_ventas(company_id)
    or exists (
      select 1 from sales v
      where v.id = payments.sale_id and es_mi_registro(v.staff_id)
    )
  )
  with check (
    puede_editar_ventas(company_id)
    or exists (
      select 1 from sales v
      where v.id = payments.sale_id and es_mi_registro(v.staff_id)
    )
  );
