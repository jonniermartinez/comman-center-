-- ============================================================
-- Command Center · 016 · Enlazar cada pago con su venta
--
-- En el Excel la relación entre un pago y su crédito es la cadena "Referencia
-- Crédito", escrita a mano en las dos hojas. Acá se resuelve una vez y queda
-- guardada en `payments.sale_id`, para no repetir el emparejamiento por texto
-- en cada consulta.
--
-- Un pago sin venta encontrada se queda con `sale_id` nulo a propósito: perder
-- plata registrada por no hallar su crédito sería peor que tenerla suelta.
-- ============================================================
create or replace function link_payments_to_sales()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  enlazados integer;
begin
  if not is_super_admin() and (select auth.role()) <> 'service_role' then
    raise exception 'Solo el super admin puede reconstruir el enlace de pagos';
  end if;

  with pareja as (
    select distinct on (p.id) p.id as payment_id, s.id as sale_id
    from payments p
    join sales s
      on s.company_id = p.company_id
     and s.ref_credito = p.ref_credito
    where p.ref_credito is not null
      and p.sale_id is null
    -- Si la referencia se repite, gana la venta más cercana en el tiempo al pago.
    order by p.id, abs(s.report_date - p.report_date)
  )
  update payments p
     set sale_id = pareja.sale_id
    from pareja
   where p.id = pareja.payment_id;

  get diagnostics enlazados = row_count;
  return enlazados;
end;
$$;

revoke all on function link_payments_to_sales() from public, anon;
grant execute on function link_payments_to_sales() to authenticated, service_role;
