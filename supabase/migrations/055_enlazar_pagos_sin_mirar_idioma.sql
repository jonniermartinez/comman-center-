-- ============================================================
-- Command Center · 055 · El enlace de pagos no distingue mayúsculas ni idioma del mes
--
-- La referencia del crédito la arma una fórmula de Excel con la fecha escrita
-- en letras, y Excel escribe el mes según el idioma del equipo que abrió el
-- archivo por última vez: la hoja de ventas de Candelaria pasó a decir
-- "14-Nov-24" mientras sus pagos siguen diciendo "14-nov-24". Comparando
-- letra por letra, 370 de sus 385 pagos quedaban sin venta.
--
-- Y no es solo la mayúscula: ese equipo tiene Excel en inglés, así que
-- diciembre salió "Dec", enero "Jan", abril "Apr" y agosto "Aug". Los otros
-- ocho meses se abrevian igual en los dos idiomas.
--
-- Es la misma referencia. Se compara sin mayúsculas ni espacios sobrantes y
-- con el mes en español; lo guardado no se toca, queda como vino del Excel.
-- ============================================================
create or replace function ref_credito_normalizada(ref text)
returns text
language sql
immutable
as $$
  select replace(replace(replace(replace(lower(btrim(ref)),
           '-jan-', '-ene-'), '-apr-', '-abr-'), '-aug-', '-ago-'), '-dec-', '-dic-')
$$;

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
     and ref_credito_normalizada(s.ref_credito) = ref_credito_normalizada(p.ref_credito)
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
