-- ============================================================
-- Command Center · 014 · Los reportes, calculados
--
-- Nada de esto se digita: sale de `sales`, `payments` y `daily_activity`. Es
-- la garantía de que el mensual siempre cuadre con el detalle.
-- ============================================================

-- Hora a la que se espera al equipo. De acá sale el KPI de llegadas tarde, que
-- no puede ser una constante en el código: cada empresa abre a su hora.
alter table companies add column if not exists hora_entrada time not null default '08:00';

-- Las renovaciones son un producto ("Ren A2", "Ren C1"), no un tipo de venta
-- aparte. Marcarlas en el catálogo evita repartir por todas las consultas la
-- regla de "empieza por Ren".
alter table products add column if not exists is_renovacion boolean not null default false;

-- ------------------------------------------------------------
-- Actividad diaria con sus totales y ratios.
-- ------------------------------------------------------------
create or replace view v_daily_activity as
select
  a.*,
  c.hora_entrada,
  -- Llegó tarde. Null si no se registró hora: no es lo mismo "llegó a tiempo"
  -- que "no quedó registrado".
  case when a.hora_llegada is null then null
       else a.hora_llegada > c.hora_entrada end as llego_tarde,

  (a.agenda_confirmada + a.agenda_posible + a.agenda_reprograma
   + a.agenda_no_contesta + a.agenda_cancela) as total_agendas,

  (a.llamada_no_contestada + a.llamada_efectiva + a.llamada_seguimiento
   + a.llamada_agenda + a.llamada_no_interesado + a.llamada_contestada
   + a.llamada_postventa) as total_llamadas,

  (a.llamada_efectiva + a.llamada_seguimiento + a.llamada_agenda
   + a.llamada_no_interesado + a.llamada_contestada + a.llamada_postventa)
   as llamadas_contestadas,

  (a.atencion_venta + a.atencion_seguimiento + a.atencion_declinado)
   as total_atencion,

  -- Cuánto bajó la cola de trabajo durante el día.
  (a.chats_inicial - a.chats_final)         as chats_depurados,
  (a.tareas_inicial - a.tareas_final)       as tareas_depuradas,
  (a.caducadas_inicial - a.caducadas_final) as caducadas_depuradas,

  safe_ratio(a.llamada_efectiva,
             a.llamada_efectiva + a.llamada_seguimiento + a.llamada_agenda
             + a.llamada_no_interesado + a.llamada_contestada + a.llamada_postventa)
             as volumen_venta_general,
  safe_ratio(a.llamada_efectiva,
             a.llamada_no_contestada + a.llamada_efectiva + a.llamada_seguimiento
             + a.llamada_agenda + a.llamada_no_interesado + a.llamada_contestada
             + a.llamada_postventa) as ratio_conversion_llamada,
  safe_ratio(a.llamada_efectiva + a.llamada_seguimiento + a.llamada_agenda
             + a.llamada_no_interesado + a.llamada_contestada + a.llamada_postventa,
             a.llamada_no_contestada + a.llamada_efectiva + a.llamada_seguimiento
             + a.llamada_agenda + a.llamada_no_interesado + a.llamada_contestada
             + a.llamada_postventa) as ratio_contactabilidad,
  safe_ratio(a.atencion_agenda,
             a.agenda_confirmada + a.agenda_posible + a.agenda_reprograma
             + a.agenda_no_contesta + a.agenda_cancela) as ratio_conversion_agendas,
  safe_ratio(a.atencion_venta,
             a.atencion_venta + a.atencion_seguimiento + a.atencion_declinado)
             as ratio_venta_presencial
from daily_activity a
join companies c on c.id = a.company_id;

alter view v_daily_activity set (security_invoker = true);

-- ------------------------------------------------------------
-- Consolidado del mes por persona. Los ratios se recalculan sobre los totales:
-- promediar los ratios diarios da un número falso.
-- ------------------------------------------------------------
create or replace view v_monthly_activity as
with base as (
  select
    company_id, branch_id, period_month, staff_id,
    max(responsable_nombre) as responsable_nombre,
    count(*) as dias_reportados,
    count(*) filter (where llego_tarde) as dias_tarde,
    sum(total_llamadas)       as total_llamadas,
    sum(llamadas_contestadas) as llamadas_contestadas,
    sum(llamada_efectiva)     as llamada_efectiva,
    sum(llamada_agenda)       as llamada_agenda,
    sum(total_agendas)        as total_agendas,
    sum(atencion_agenda)      as atencion_agenda,
    sum(total_atencion)       as total_atencion,
    sum(atencion_venta)       as atencion_venta,
    sum(atencion_certificados) as atencion_certificados,
    sum(atencion_renovacion)  as atencion_renovacion,
    sum(chats_depurados)      as chats_depurados,
    sum(tareas_depuradas)     as tareas_depuradas
  from v_daily_activity
  group by company_id, branch_id, period_month, staff_id
)
select
  b.*,
  safe_ratio(b.llamada_efectiva, b.llamadas_contestadas) as volumen_venta_general,
  safe_ratio(b.llamada_efectiva, b.total_llamadas)       as ratio_conversion_llamada,
  safe_ratio(b.llamadas_contestadas, b.total_llamadas)   as ratio_contactabilidad,
  safe_ratio(b.atencion_agenda, b.total_agendas)         as ratio_conversion_agendas,
  safe_ratio(b.atencion_venta, b.total_atencion)         as ratio_venta_presencial,
  safe_ratio(b.dias_tarde, b.dias_reportados)            as ratio_llegadas_tarde
from base b;

alter view v_monthly_activity set (security_invoker = true);

-- ------------------------------------------------------------
-- Ventas: diario y mensual, por empresa y por sede.
-- ------------------------------------------------------------
create or replace view v_daily_sales as
select
  s.company_id,
  s.branch_id,
  s.report_date,
  count(*) filter (where not coalesce(p.is_renovacion, false)) as ventas,
  count(*) filter (where coalesce(p.is_renovacion, false))     as renovaciones,
  sum(s.cantidad_final)                                        as licencias,
  sum(s.valor_final)                                           as facturacion,
  sum(s.recaudo)                                               as recaudo_venta,
  sum(s.saldo)                                                 as saldo,
  sum(s.valor_comision)                                        as comision
from sales s
left join products p on p.code = s.product_code
group by s.company_id, s.branch_id, s.report_date;

alter view v_daily_sales set (security_invoker = true);

create or replace view v_monthly_sales_by_financing as
select
  s.company_id,
  s.branch_id,
  s.period_month,
  s.financing_code,
  f.name as financing_name,
  count(*) filter (where not coalesce(p.is_renovacion, false)) as ventas,
  count(*) filter (where coalesce(p.is_renovacion, false))     as renovaciones,
  sum(s.cantidad_final)                                        as licencias,
  sum(s.valor_final)                                           as facturacion
from sales s
left join products p on p.code = s.product_code
left join financing_types f on f.code = s.financing_code
group by s.company_id, s.branch_id, s.period_month, s.financing_code, f.name;

alter view v_monthly_sales_by_financing set (security_invoker = true);

-- ------------------------------------------------------------
-- Recaudo: lo que efectivamente entró, por medio de pago.
-- ------------------------------------------------------------
create or replace view v_monthly_collection as
select
  company_id,
  branch_id,
  period_month,
  method_code,
  sum(amount) as amount,
  count(*)    as pagos
from payments
group by company_id, branch_id, period_month, method_code;

alter view v_monthly_collection set (security_invoker = true);

-- ------------------------------------------------------------
-- Totales del mes por empresa: lo que alimenta las tarjetas del dashboard.
-- ------------------------------------------------------------
create or replace view v_monthly_totals as
with ventas as (
  select s.company_id, s.period_month,
         count(*) filter (where not coalesce(p.is_renovacion, false)) as ventas_mes,
         count(*) filter (where coalesce(p.is_renovacion, false))     as renovaciones_mes,
         sum(s.cantidad_final) as licencias_mes,
         sum(s.valor_final)    as facturacion_mes
  from sales s
  left join products p on p.code = s.product_code
  group by s.company_id, s.period_month
),
recaudo as (
  select company_id, period_month, sum(amount) as recaudo_mes
  from payments group by company_id, period_month
),
caja as (
  select company_id, period_month,
         sum(amount) filter (where kind = 'entrada') as entradas_mes,
         sum(amount) filter (where kind = 'salida')  as salidas_mes
  from cash_movements group by company_id, period_month
),
periodos as (
  select company_id, period_month from ventas
  union select company_id, period_month from recaudo
  union select company_id, period_month from caja
)
select
  p.company_id,
  c.name as company_name,
  p.period_month,
  coalesce(v.ventas_mes, 0)       as ventas_mes,
  coalesce(v.licencias_mes, 0)    as licencias_mes,
  coalesce(v.renovaciones_mes, 0) as renovaciones_mes,
  coalesce(v.facturacion_mes, 0)  as facturacion_mes,
  coalesce(r.recaudo_mes, 0)      as recaudo_mes,
  coalesce(j.entradas_mes, 0)     as entradas_mes,
  coalesce(j.salidas_mes, 0)      as salidas_mes
from periodos p
join companies c on c.id = p.company_id
left join ventas  v on v.company_id = p.company_id and v.period_month = p.period_month
left join recaudo r on r.company_id = p.company_id and r.period_month = p.period_month
left join caja    j on j.company_id = p.company_id and j.period_month = p.period_month;

alter view v_monthly_totals set (security_invoker = true);

-- ------------------------------------------------------------
-- Desglose por sede.
-- ------------------------------------------------------------
create or replace view v_branch_monthly as
with ventas as (
  select s.company_id, s.branch_id, s.period_month,
         count(*) filter (where not coalesce(p.is_renovacion, false)) as ventas_mes,
         sum(s.cantidad_final) as licencias_mes,
         sum(s.valor_final)    as facturacion_mes
  from sales s
  left join products p on p.code = s.product_code
  group by s.company_id, s.branch_id, s.period_month
),
recaudo as (
  select company_id, branch_id, period_month, sum(amount) as recaudo_mes
  from payments group by company_id, branch_id, period_month
),
actividad as (
  select company_id, branch_id, period_month,
         sum(total_llamadas) as total_llamadas,
         sum(llamadas_contestadas) as llamadas_contestadas,
         sum(llamada_efectiva) as llamada_efectiva
  from v_daily_activity group by company_id, branch_id, period_month
),
periodos as (
  select company_id, branch_id, period_month from ventas
  union select company_id, branch_id, period_month from recaudo
  union select company_id, branch_id, period_month from actividad
)
select
  p.branch_id,
  p.company_id,
  b.name as branch_name,
  b.is_primary,
  b.status,
  p.period_month,
  (select count(*) from company_staff cs where cs.branch_id = p.branch_id) as comerciales,
  coalesce(v.ventas_mes, 0)      as ventas_mes,
  coalesce(v.licencias_mes, 0)   as licencias_mes,
  coalesce(v.facturacion_mes, 0) as facturacion_mes,
  coalesce(r.recaudo_mes, 0)     as recaudo_mes,
  coalesce(a.total_llamadas, 0)       as total_llamadas,
  coalesce(a.llamadas_contestadas, 0) as llamadas_contestadas,
  coalesce(a.llamada_efectiva, 0)     as llamada_efectiva,
  safe_ratio(a.llamadas_contestadas, a.total_llamadas) as ratio_contactabilidad
from periodos p
join branches b on b.id = p.branch_id
left join ventas    v on v.branch_id = p.branch_id and v.period_month = p.period_month
left join recaudo   r on r.branch_id = p.branch_id and r.period_month = p.period_month
left join actividad a on a.branch_id = p.branch_id and a.period_month = p.period_month;

alter view v_branch_monthly set (security_invoker = true);

-- ------------------------------------------------------------
-- Quién registró hoy y quién no.
-- ------------------------------------------------------------
create or replace view v_capture_status as
select
  cs.company_id,
  cs.branch_id,
  cs.staff_id,
  s.full_name as responsable_nombre,
  current_date as report_date,
  exists (
    select 1 from daily_activity a
    where a.company_id = cs.company_id
      and a.staff_id = cs.staff_id
      and a.report_date = current_date
  ) as registrado
from company_staff cs
join staff s on s.id = cs.staff_id
where s.active;

alter view v_capture_status set (security_invoker = true);

-- ------------------------------------------------------------
-- Cuánto tiene a su nombre cada usuario con cuenta.
-- ------------------------------------------------------------
create or replace view v_user_activity as
select
  p.id as user_id,
  coalesce((
    select count(*) from daily_activity a
    join staff s on s.id = a.staff_id
    where s.profile_id = p.id
  ), 0) +
  coalesce((
    select count(*) from sales v
    join staff s on s.id = v.staff_id
    where s.profile_id = p.id
  ), 0) as registros
from profiles p;

alter view v_user_activity set (security_invoker = true);

-- ------------------------------------------------------------
-- Cumplimiento de objetivos sobre las fuentes nuevas.
-- ------------------------------------------------------------
create or replace view v_objective_progress as
with reales as (
  select company_id, period_month, 'ventas_mensuales'::text as metric_code,
         null::uuid as user_id, ventas_mes::numeric as real_value
  from v_monthly_totals
  union all
  select company_id, period_month, 'licencias_mensuales', null::uuid, licencias_mes::numeric
  from v_monthly_totals
  union all
  select company_id, period_month, 'facturacion', null::uuid, facturacion_mes
  from v_monthly_totals
  union all
  select company_id, period_month, 'recaudo', null::uuid, recaudo_mes
  from v_monthly_totals
  union all
  -- Métricas por persona: se atribuyen al perfil que tenga enlazado ese staff.
  select a.company_id, a.period_month, 'ventas_efectivas', s.profile_id,
         sum(a.llamada_efectiva)::numeric
  from v_monthly_activity a join staff s on s.id = a.staff_id
  where s.profile_id is not null
  group by a.company_id, a.period_month, s.profile_id
  union all
  select a.company_id, a.period_month, 'ratio_contactabilidad', s.profile_id,
         round(safe_ratio(sum(a.llamadas_contestadas), sum(a.total_llamadas)) * 100, 2)
  from v_monthly_activity a join staff s on s.id = a.staff_id
  where s.profile_id is not null
  group by a.company_id, a.period_month, s.profile_id
  union all
  select a.company_id, a.period_month, 'ratio_conversion_llamada', s.profile_id,
         round(safe_ratio(sum(a.llamada_efectiva), sum(a.total_llamadas)) * 100, 2)
  from v_monthly_activity a join staff s on s.id = a.staff_id
  where s.profile_id is not null
  group by a.company_id, a.period_month, s.profile_id
)
select
  o.company_id,
  o.period_month,
  o.metric_code,
  m.name as metric_name,
  m.unit,
  o.user_id,
  o.target_value,
  coalesce(r.real_value, 0) as real_value,
  safe_ratio(coalesce(r.real_value, 0), o.target_value) as cumplimiento
from objectives o
join metrics m on m.code = o.metric_code
left join reales r
  on  r.company_id  = o.company_id
  and r.period_month = o.period_month
  and r.metric_code  = o.metric_code
  and coalesce(r.user_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(o.user_id, '00000000-0000-0000-0000-000000000000'::uuid);

alter view v_objective_progress set (security_invoker = true);
