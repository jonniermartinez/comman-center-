-- ============================================================
-- Command Center · 002 · Vistas de KPIs y agregados
-- Los ratios y los reportes mensuales viven acá: no se digitan
-- ni se guardan, se calculan. Así nunca hay descuadre con el detalle.
-- ============================================================

-- División segura: null en vez de error/0 cuando el denominador es 0.
create or replace function safe_ratio(numerador numeric, denominador numeric)
returns numeric
language sql
immutable
as $$
  select case when coalesce(denominador, 0) = 0
              then null
              else round(numerador::numeric / denominador, 4)
         end;
$$;

-- ------------------------------------------------------------
-- KPI Diario con los seis ratios del Excel
-- ------------------------------------------------------------
create or replace view v_daily_kpi as
select
  k.*,
  safe_ratio(k.ventas_efectivas,     k.llamadas_contestadas) as volumen_venta_general,
  safe_ratio(k.ventas_efectivas,     k.llamadas_realizadas)  as ratio_conversion_llamada,
  safe_ratio(k.llamadas_contestadas, k.llamadas_realizadas)  as ratio_contactabilidad,
  safe_ratio(k.atencion_agendas,     k.agendas_dia)          as ratio_conversion_agendas,
  safe_ratio(k.ventas_exitosas,      k.clientes_atendidos)   as ratio_venta_presencial,
  safe_ratio(k.llamada_agenda,       k.llamadas_contestadas) as volumen_venta_agendas
from daily_kpi k;

-- ------------------------------------------------------------
-- KPI consolidado del mes por empresa y responsable.
-- Los ratios se recalculan sobre los totales, NO se promedian
-- los ratios diarios (promediar ratios da un número falso).
-- ------------------------------------------------------------
create or replace view v_monthly_kpi as
select
  company_id,
  date_trunc('month', report_date)::date as period_month,
  user_id,
  max(responsable_nombre)                as responsable_nombre,
  sum(llamadas_realizadas)  as llamadas_realizadas,
  sum(llamadas_contestadas) as llamadas_contestadas,
  sum(ventas_efectivas)     as ventas_efectivas,
  sum(agendas_dia)          as agendas_dia,
  sum(atencion_agendas)     as atencion_agendas,
  sum(clientes_atendidos)   as clientes_atendidos,
  sum(ventas_exitosas)      as ventas_exitosas,
  sum(llamada_agenda)       as llamada_agenda,
  count(distinct report_date) as dias_reportados,
  safe_ratio(sum(ventas_efectivas),     sum(llamadas_contestadas)) as volumen_venta_general,
  safe_ratio(sum(ventas_efectivas),     sum(llamadas_realizadas))  as ratio_conversion_llamada,
  safe_ratio(sum(llamadas_contestadas), sum(llamadas_realizadas))  as ratio_contactabilidad,
  safe_ratio(sum(atencion_agendas),     sum(agendas_dia))          as ratio_conversion_agendas,
  safe_ratio(sum(ventas_exitosas),      sum(clientes_atendidos))   as ratio_venta_presencial,
  safe_ratio(sum(llamada_agenda),       sum(llamadas_contestadas)) as volumen_venta_agendas
from daily_kpi
group by company_id, date_trunc('month', report_date), user_id;

-- ------------------------------------------------------------
-- Gestión Diaria: inicial vs final del mismo día,
-- para ver cuánto se depuró en la jornada.
-- ------------------------------------------------------------
create or replace view v_daily_management_progress as
select
  company_id,
  report_date,
  user_id,
  max(responsable_nombre) as responsable_nombre,
  max(chats_por_responder) filter (where jornada = 'inicial') as chats_inicial,
  max(chats_por_responder) filter (where jornada = 'final')   as chats_final,
  max(tareas_del_dia)      filter (where jornada = 'inicial') as tareas_inicial,
  max(tareas_del_dia)      filter (where jornada = 'final')   as tareas_final,
  max(tareas_caducadas)    filter (where jornada = 'inicial') as caducadas_inicial,
  max(tareas_caducadas)    filter (where jornada = 'final')   as caducadas_final,
  max(certificados)        filter (where jornada = 'final')   as certificados
from daily_management
group by company_id, report_date, user_id;

-- ------------------------------------------------------------
-- Reporte de ventas diario (equivalente al "Reporte Diario" del Excel)
-- ------------------------------------------------------------
create or replace view v_daily_sales as
select
  s.company_id,
  s.report_date,
  s.financing_code,
  f.name as financing_name,
  s.kind,
  sum(s.ventas)    as ventas,
  sum(s.licencias) as licencias
from sales_entries s
join financing_types f on f.code = s.financing_code
group by s.company_id, s.report_date, s.financing_code, f.name, s.kind;

-- ------------------------------------------------------------
-- Reporte mensual: la suma de los diarios. Nunca se digita.
-- ------------------------------------------------------------
create or replace view v_monthly_sales as
select
  s.company_id,
  date_trunc('month', s.report_date)::date as period_month,
  s.financing_code,
  f.name as financing_name,
  s.kind,
  sum(s.ventas)    as ventas,
  sum(s.licencias) as licencias
from sales_entries s
join financing_types f on f.code = s.financing_code
group by s.company_id, date_trunc('month', s.report_date), s.financing_code, f.name, s.kind;

create or replace view v_monthly_billing as
select
  company_id,
  date_trunc('month', report_date)::date as period_month,
  financing_code,
  sum(amount) as amount
from billing_entries
group by company_id, date_trunc('month', report_date), financing_code;

create or replace view v_monthly_collection as
select
  company_id,
  date_trunc('month', report_date)::date as period_month,
  method_code,
  sum(amount) as amount
from collection_entries
group by company_id, date_trunc('month', report_date), method_code;

-- ------------------------------------------------------------
-- Totales del mes por empresa: lo que alimenta las tarjetas
-- de cumplimiento del dashboard.
-- ------------------------------------------------------------
create or replace view v_monthly_totals as
with ventas as (
  select company_id, date_trunc('month', report_date)::date as period_month,
         sum(ventas) filter (where kind = 'venta')       as ventas_mes,
         sum(licencias) filter (where kind = 'venta')    as licencias_mes,
         sum(ventas) filter (where kind = 'renovacion')  as renovaciones_mes
  from sales_entries
  group by 1, 2
),
fact as (
  select company_id, date_trunc('month', report_date)::date as period_month,
         sum(amount) as facturacion_mes
  from billing_entries group by 1, 2
),
rec as (
  select company_id, date_trunc('month', report_date)::date as period_month,
         sum(amount) as recaudo_mes
  from collection_entries group by 1, 2
)
select
  c.id   as company_id,
  c.name as company_name,
  p.period_month,
  coalesce(v.ventas_mes, 0)       as ventas_mes,
  coalesce(v.licencias_mes, 0)    as licencias_mes,
  coalesce(v.renovaciones_mes, 0) as renovaciones_mes,
  coalesce(f.facturacion_mes, 0)  as facturacion_mes,
  coalesce(r.recaudo_mes, 0)      as recaudo_mes
from companies c
cross join (
  select distinct period_month from (
    select period_month from ventas
    union select period_month from fact
    union select period_month from rec
  ) x
) p
left join ventas v on v.company_id = c.id and v.period_month = p.period_month
left join fact   f on f.company_id = c.id and f.period_month = p.period_month
left join rec    r on r.company_id = c.id and r.period_month = p.period_month;

-- ------------------------------------------------------------
-- Cumplimiento de objetivos: meta vs real, por empresa/mes/métrica.
-- user_id null = meta de empresa.
-- ------------------------------------------------------------
create or replace view v_objective_progress as
with real_values as (
  -- métricas de venta a nivel empresa
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
  -- métricas de KPI por responsable
  select company_id, period_month, 'ratio_contactabilidad', user_id,
         round(ratio_contactabilidad * 100, 2)
  from v_monthly_kpi
  union all
  select company_id, period_month, 'ratio_conversion_llamada', user_id,
         round(ratio_conversion_llamada * 100, 2)
  from v_monthly_kpi
  union all
  select company_id, period_month, 'ventas_efectivas', user_id, ventas_efectivas::numeric
  from v_monthly_kpi
)
select
  o.company_id,
  o.period_month,
  o.metric_code,
  m.name as metric_name,
  m.unit,
  o.user_id,
  o.target_value,
  coalesce(rv.real_value, 0) as real_value,
  safe_ratio(coalesce(rv.real_value, 0), o.target_value) as cumplimiento
from objectives o
join metrics m on m.code = o.metric_code
left join real_values rv
  on  rv.company_id  = o.company_id
  and rv.period_month = o.period_month
  and rv.metric_code  = o.metric_code
  and coalesce(rv.user_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(o.user_id, '00000000-0000-0000-0000-000000000000'::uuid);

-- ------------------------------------------------------------
-- Estado de captura del día: quién registró y quién no.
-- Alimenta el aviso "⚠ sin registrar hoy" del grid de empresas.
-- ------------------------------------------------------------
create or replace view v_capture_status as
select
  cu.company_id,
  cu.user_id,
  p.full_name as responsable_nombre,
  current_date as report_date,
  exists (select 1 from daily_kpi k
          where k.company_id = cu.company_id and k.user_id = cu.user_id
            and k.report_date = current_date) as kpi_registrado,
  exists (select 1 from daily_management d
          where d.company_id = cu.company_id and d.user_id = cu.user_id
            and d.report_date = current_date) as gestion_registrada
from company_users cu
join profiles p on p.id = cu.user_id
where cu.removed_at is null
  and p.deleted_at is null
  and p.status = 'activo';

-- ------------------------------------------------------------
-- Totales del mes por sede: el desglose del dashboard de empresa.
-- El total de la empresa es la suma de estas filas.
-- ------------------------------------------------------------
create or replace view v_branch_monthly as
with ventas as (
  select branch_id, date_trunc('month', report_date)::date as period_month,
         sum(ventas)    filter (where kind = 'venta') as ventas_mes,
         sum(licencias) filter (where kind = 'venta') as licencias_mes
  from sales_entries group by 1, 2
),
fact as (
  select branch_id, date_trunc('month', report_date)::date as period_month,
         sum(amount) as facturacion_mes
  from billing_entries group by 1, 2
),
rec as (
  select branch_id, date_trunc('month', report_date)::date as period_month,
         sum(amount) as recaudo_mes
  from collection_entries group by 1, 2
),
kpi as (
  select branch_id, date_trunc('month', report_date)::date as period_month,
         sum(llamadas_realizadas)  as llamadas_realizadas,
         sum(llamadas_contestadas) as llamadas_contestadas,
         sum(ventas_efectivas)     as ventas_efectivas
  from daily_kpi group by 1, 2
),
equipo as (
  select branch_id, count(*) as comerciales
  from company_users where removed_at is null and branch_id is not null
  group by 1
)
select
  b.id         as branch_id,
  b.company_id,
  b.name       as branch_name,
  b.is_primary,
  b.status,
  p.period_month,
  coalesce(e.comerciales, 0)      as comerciales,
  coalesce(v.ventas_mes, 0)       as ventas_mes,
  coalesce(v.licencias_mes, 0)    as licencias_mes,
  coalesce(f.facturacion_mes, 0)  as facturacion_mes,
  coalesce(r.recaudo_mes, 0)      as recaudo_mes,
  coalesce(k.llamadas_realizadas, 0)  as llamadas_realizadas,
  coalesce(k.llamadas_contestadas, 0) as llamadas_contestadas,
  coalesce(k.ventas_efectivas, 0)     as ventas_efectivas,
  safe_ratio(k.llamadas_contestadas, k.llamadas_realizadas) as ratio_contactabilidad
from branches b
cross join (
  select distinct period_month from (
    select period_month from ventas
    union select period_month from fact
    union select period_month from rec
    union select period_month from kpi
  ) x
) p
left join ventas v on v.branch_id = b.id and v.period_month = p.period_month
left join fact   f on f.branch_id = b.id and f.period_month = p.period_month
left join rec    r on r.branch_id = b.id and r.period_month = p.period_month
left join kpi    k on k.branch_id = b.id and k.period_month = p.period_month
left join equipo e on e.branch_id = b.id;
