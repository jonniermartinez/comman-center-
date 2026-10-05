-- ============================================================
-- Command Center · 059 · Las ventas y los pagos se archivan
--
-- Una venta o un pago que no debía estar —una prueba, un duplicado, algo
-- digitado en la empresa equivocada— solo tenía una salida: borrarlo. Y
-- borrar no tiene vuelta atrás. Archivar sí: el registro sale de los listados
-- y de todas las cifras, pero sigue en la base y se puede restaurar.
--
-- Lo que significa "archivado", en todas partes igual:
--   · no aparece en el listado, salvo con "Ver archivadas";
--   · no suma en ventas, facturación, recaudo, saldo ni indicadores;
--   · no se le puede enlazar un pago nuevo.
--
-- Quién archiva es quien ya podía borrar. Una venta, solo el super admin
-- (042): archivar la saca de las cifras igual que borrarla, y si lo pudiera
-- hacer cualquiera el bloqueo de la 039 volvería a ser un adorno. Un pago,
-- quien administra la empresa o el dueño de la venta (024).
--
-- Archivar una venta archiva con ella sus pagos: plata recaudada contra una
-- venta que ya no cuenta descuadraría el recaudo del mes. Restaurarla los
-- trae de vuelta —solo esos, no los que alguien había archivado antes por
-- separado—.
-- ============================================================
alter table sales    add column if not exists archived_at timestamptz;
alter table payments add column if not exists archived_at timestamptz;

comment on column sales.archived_at is
  'Cuándo se archivó. Null = vigente. Una venta archivada no sale en listados ni suma en ninguna cifra.';
comment on column payments.archived_at is
  'Cuándo se archivó. Null = vigente. Si coincide con el archived_at de su venta, se archivó junto con ella y vuelve con ella.';

/*
 * Quién puede archivar o restaurar un pago.
 *
 * La política de update de payments deja corregir a cualquiera de la empresa
 * (025), y archivar es un update. Sin esto, cualquiera podría sacar plata del
 * recaudo sin poder borrarla. La regla es la misma de payments_delete.
 *
 * Tampoco se restaura suelto un pago cuya venta sigue archivada: quedaría
 * sumando recaudo contra una venta que no cuenta.
 */
create or replace function payments_proteger_archivado()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not (
    can_manage_company(new.company_id)
    or exists (select 1 from sales v where v.id = new.sale_id and es_mi_registro(v.staff_id))
  ) then
    raise exception 'archivar_sin_permiso';
  end if;

  if new.archived_at is null and exists (
    select 1 from sales v where v.id = new.sale_id and v.archived_at is not null
  ) then
    raise exception 'venta_archivada';
  end if;

  return new;
end;
$$;

drop trigger if exists payments_proteger_archivado on payments;
create trigger payments_proteger_archivado
  before update of archived_at on payments
  for each row
  when (old.archived_at is distinct from new.archived_at)
  execute function payments_proteger_archivado();

/*
 * Los pagos siguen a su venta.
 *
 * Se marcan con el mismo instante que la venta: así, al restaurarla, se sabe
 * cuáles se archivaron con ella y cuáles ya estaban archivados por su cuenta.
 */
create or replace function sales_archivar_pagos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.archived_at is not null then
    update payments set archived_at = new.archived_at
     where sale_id = new.id and archived_at is null;
  else
    update payments set archived_at = null
     where sale_id = new.id and archived_at = old.archived_at;
  end if;
  return null;
end;
$$;

drop trigger if exists sales_archivar_pagos on sales;
create trigger sales_archivar_pagos
  after update of archived_at on sales
  for each row
  when (old.archived_at is distinct from new.archived_at)
  execute function sales_archivar_pagos();

/*
 * El recaudo de una venta no cuenta los pagos archivados.
 *
 * Los que se archivaron junto con la venta sí se siguen sumando: una venta
 * archivada conserva su recaudo y su saldo tal como estaban, que es lo que se
 * espera ver al abrir "Ver archivadas".
 */
create or replace function payments_refrescar_recaudo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  afectadas uuid[] := '{}';
  afectada  uuid;
begin
  if tg_op <> 'INSERT' and old.sale_id is not null then
    afectadas := afectadas || old.sale_id;
  end if;
  if tg_op <> 'DELETE' and new.sale_id is not null then
    afectadas := afectadas || new.sale_id;
  end if;

  foreach afectada in array afectadas loop
    update sales s
       set recaudo = (
             select coalesce(sum(p.amount), 0)
               from payments p
              where p.sale_id = s.id
                and (p.archived_at is null or p.archived_at = s.archived_at)
           )
     where s.id = afectada;
  end loop;

  return null;
end;
$$;

-- ------------------------------------------------------------
-- Las vistas de los tableros dejan de contar lo archivado. Mismas columnas,
-- mismo orden: lo único que cambia es el `where archived_at is null`.
-- ------------------------------------------------------------
create or replace view v_daily_sales with (security_invoker = true) as
select
  s.company_id,
  s.branch_id,
  s.report_date,
  count(*) filter (where not coalesce(cp.is_renovacion, p.is_renovacion, false)) as ventas,
  count(*) filter (where coalesce(cp.is_renovacion, p.is_renovacion, false))     as renovaciones,
  sum(s.cantidad_final) as licencias,
  sum(s.valor_final)    as facturacion,
  sum(s.recaudo)        as recaudo_venta,
  sum(s.saldo)          as saldo,
  sum(s.valor_comision) as comision
from sales s
left join products p on p.code = s.product_code
left join company_products cp on cp.id = s.company_product_id
where s.archived_at is null
group by s.company_id, s.branch_id, s.report_date;

create or replace view v_monthly_sales_by_financing with (security_invoker = true) as
select
  s.company_id,
  s.branch_id,
  s.period_month,
  s.financing_code,
  f.name as financing_name,
  count(*) filter (where not coalesce(cp.is_renovacion, p.is_renovacion, false)) as ventas,
  count(*) filter (where coalesce(cp.is_renovacion, p.is_renovacion, false))     as renovaciones,
  sum(s.cantidad_final) as licencias,
  sum(s.valor_final)    as facturacion
from sales s
left join products p on p.code = s.product_code
left join company_products cp on cp.id = s.company_product_id
left join financing_types f on f.code = s.financing_code
where s.archived_at is null
group by s.company_id, s.branch_id, s.period_month, s.financing_code, f.name;

create or replace view v_monthly_collection with (security_invoker = true) as
select
  company_id,
  branch_id,
  period_month,
  method_code,
  sum(amount) as amount,
  count(*)    as pagos
from payments
where archived_at is null
group by company_id, branch_id, period_month, method_code;

create or replace view v_monthly_totals with (security_invoker = true) as
with ventas as (
  select
    s.company_id,
    s.period_month,
    count(*) filter (where not coalesce(cp.is_renovacion, p_1.is_renovacion, false)) as ventas_mes,
    count(*) filter (where coalesce(cp.is_renovacion, p_1.is_renovacion, false))     as renovaciones_mes,
    sum(s.cantidad_final) as licencias_mes,
    sum(s.valor_final)    as facturacion_mes
  from sales s
  left join products p_1 on p_1.code = s.product_code
  left join company_products cp on cp.id = s.company_product_id
  where s.archived_at is null
  group by s.company_id, s.period_month
), recaudo as (
  select company_id, period_month, sum(amount) as recaudo_mes
  from payments
  where archived_at is null
  group by company_id, period_month
), caja as (
  select
    company_id,
    period_month,
    sum(amount) filter (where kind = 'entrada') as entradas_mes,
    sum(amount) filter (where kind = 'salida')  as salidas_mes
  from cash_movements
  group by company_id, period_month
), periodos as (
  select company_id, period_month from ventas
  union
  select company_id, period_month from recaudo
  union
  select company_id, period_month from caja
)
select
  p.company_id,
  c.name as company_name,
  p.period_month,
  coalesce(v.ventas_mes, 0::bigint)        as ventas_mes,
  coalesce(v.licencias_mes, 0::numeric)    as licencias_mes,
  coalesce(v.renovaciones_mes, 0::bigint)  as renovaciones_mes,
  coalesce(v.facturacion_mes, 0::numeric)  as facturacion_mes,
  coalesce(r.recaudo_mes, 0::numeric)      as recaudo_mes,
  coalesce(j.entradas_mes, 0::numeric)     as entradas_mes,
  coalesce(j.salidas_mes, 0::numeric)      as salidas_mes
from periodos p
join companies c on c.id = p.company_id
left join ventas v  on v.company_id = p.company_id and v.period_month = p.period_month
left join recaudo r on r.company_id = p.company_id and r.period_month = p.period_month
left join caja j    on j.company_id = p.company_id and j.period_month = p.period_month;

create or replace view v_branch_monthly with (security_invoker = true) as
with ventas as (
  select
    s.company_id,
    s.branch_id,
    s.period_month,
    count(*) filter (where not coalesce(cp.is_renovacion, p_1.is_renovacion, false)) as ventas_mes,
    sum(s.cantidad_final) as licencias_mes,
    sum(s.valor_final)    as facturacion_mes
  from sales s
  left join products p_1 on p_1.code = s.product_code
  left join company_products cp on cp.id = s.company_product_id
  where s.archived_at is null
  group by s.company_id, s.branch_id, s.period_month
), recaudo as (
  select company_id, branch_id, period_month, sum(amount) as recaudo_mes
  from payments
  where archived_at is null
  group by company_id, branch_id, period_month
), actividad as (
  select
    company_id,
    branch_id,
    period_month,
    sum(total_llamadas)       as total_llamadas,
    sum(llamadas_contestadas) as llamadas_contestadas,
    sum(llamada_efectiva)     as llamada_efectiva
  from v_daily_activity
  group by company_id, branch_id, period_month
), periodos as (
  select company_id, branch_id, period_month from ventas
  union
  select company_id, branch_id, period_month from recaudo
  union
  select company_id, branch_id, period_month from actividad
)
select
  p.branch_id,
  p.company_id,
  b.name as branch_name,
  b.is_primary,
  b.status,
  p.period_month,
  (select count(*) from company_staff cs where cs.branch_id = p.branch_id) as comerciales,
  coalesce(v.ventas_mes, 0::bigint)            as ventas_mes,
  coalesce(v.licencias_mes, 0::numeric)        as licencias_mes,
  coalesce(v.facturacion_mes, 0::numeric)      as facturacion_mes,
  coalesce(r.recaudo_mes, 0::numeric)          as recaudo_mes,
  coalesce(a.total_llamadas, 0::bigint)        as total_llamadas,
  coalesce(a.llamadas_contestadas, 0::bigint)  as llamadas_contestadas,
  coalesce(a.llamada_efectiva, 0::bigint)      as llamada_efectiva,
  safe_ratio(a.llamadas_contestadas::numeric, a.total_llamadas::numeric) as ratio_contactabilidad
from periodos p
join branches b on b.id = p.branch_id
left join ventas v    on v.branch_id = p.branch_id and v.period_month = p.period_month
left join recaudo r   on r.branch_id = p.branch_id and r.period_month = p.period_month
left join actividad a on a.branch_id = p.branch_id and a.period_month = p.period_month;

-- Los indicadores por comercial: la definición vigente con el filtro puesto en
-- el único sitio donde lee ventas. Se reescribe en vez de copiarla entera,
-- como en la 058, para no arrastrar cuarenta columnas que no cambian.
do $$
declare
  d text;
  ancla constant text := 'from sales s' || chr(10) || '    where s.company_id = p_company';
begin
  d := pg_get_functiondef('indicadores_por_comercial(uuid, date, date)'::regprocedure);
  if d not like '%s.archived_at is null%' then
    if position(ancla in d) = 0 then
      raise exception 'La función indicadores_por_comercial no tiene la forma esperada';
    end if;
    d := replace(d, ancla, ancla || chr(10) || '      and s.archived_at is null');
    execute d;
  end if;
end;
$$;
