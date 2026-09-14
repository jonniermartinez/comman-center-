-- ============================================================
-- Command Center · 044 · La gestión diaria, como la lee el equipo
--
-- Cuatro cosas que salieron de la revisión del 10 y 11 de septiembre:
--
-- 1. "Llamadas contestadas" no se digita: es la suma de las tipificaciones
--    (efectiva + seguimiento + agenda + no interesado + postventa). Cuando era
--    un campo aparte, el equipo lo llenaba mal y no cuadraba con el detalle.
--    Las vistas de la 014 además lo sumaban como si fuera una tipificación más,
--    así que el total de llamadas contaba dos veces cada llamada contestada.
--    De las 9.955 jornadas importadas del Excel, 9.549 traen la columna igual a
--    la suma: en el Excel también era una fórmula.
--
-- 2. La atención presencial gana "venta externa", y se separa en tres bloques:
--    venta presencial (venta, seguimiento, declinado, externa), agenda
--    atendida (un dato suelto que no suma, porque ese cliente ya está contado
--    como venta o seguimiento) y administrativa (asociado, enrolamiento,
--    certificados, renovaciones).
--
-- 3. Los días hábiles del mes son un dato de la empresa, no una cuenta de
--    lunes a sábado: en julio fueron 21 y el absentismo se mide contra eso.
--
-- 4. Una venta puede llevar fotos del comprobante, una o varias. Van al mismo
--    bucket privado de los pagos, en la carpeta de la empresa.
--
-- Y una función para el tablero de indicadores: los totales de la gestión y
-- de las ventas por comercial en cualquier rango de fechas. Las vistas
-- mensuales no sirven para "del 3 al 17"; esta sí, y sigue siendo Postgres el
-- que suma.
-- ============================================================

-- ------------------------------------------------------------
-- 1 y 2. Columnas nuevas y la contestada como dato derivado.
-- ------------------------------------------------------------
alter table daily_activity
  add column if not exists atencion_venta_externa int not null default 0
    check (atencion_venta_externa >= 0);

comment on column daily_activity.atencion_venta_externa is
  'Atención presencial que terminó en venta fuera del punto (externa). Suma al total de atención presencial.';

comment on column daily_activity.llamada_contestada is
  'Derivada: efectiva + seguimiento + agenda + no interesado + postventa. La aplicación la escribe calculada; ninguna vista la lee.';

-- Las jornadas que traían la contestada mal digitada quedan con la suma real.
update daily_activity
   set llamada_contestada = llamada_efectiva + llamada_seguimiento + llamada_agenda
                          + llamada_no_interesado + llamada_postventa
 where llamada_contestada <> llamada_efectiva + llamada_seguimiento + llamada_agenda
                          + llamada_no_interesado + llamada_postventa;

-- ------------------------------------------------------------
-- 3. Días hábiles por empresa y mes.
-- ------------------------------------------------------------
create table if not exists company_business_days (
  company_id   uuid not null references companies (id) on delete cascade,
  period_month date not null,
  dias         int  not null check (dias between 1 and 31),
  updated_by   uuid references profiles (id),
  updated_at   timestamptz not null default now(),
  primary key (company_id, period_month),
  constraint company_business_days_dia_uno
    check (date_trunc('month', period_month)::date = period_month)
);

comment on table company_business_days is
  'Cuántos días hábiles trabaja la empresa cada mes. Contra eso se mide el absentismo. Sin fila se asume lunes a sábado.';

alter table company_business_days enable row level security;

create policy company_business_days_select on company_business_days
  for select using (company_id in (select my_company_ids()));
create policy company_business_days_insert on company_business_days
  for insert with check (can_manage_company(company_id));
create policy company_business_days_update on company_business_days
  for update using (can_manage_company(company_id)) with check (can_manage_company(company_id));
create policy company_business_days_delete on company_business_days
  for delete using (can_manage_company(company_id));

-- ------------------------------------------------------------
-- 4. Fotos del comprobante de una venta.
-- ------------------------------------------------------------
create table if not exists sale_attachments (
  id         uuid primary key default gen_random_uuid(),
  sale_id    uuid not null references sales (id) on delete cascade,
  company_id uuid not null references companies (id) on delete cascade,
  path       text not null,
  created_at timestamptz not null default now(),
  created_by uuid references profiles (id)
);

comment on table sale_attachments is
  'Fotos o PDF del comprobante de pago de una venta, en el bucket comprobantes-pago bajo <company_id>/ventas/.';

create index sale_attachments_sale_idx on sale_attachments (sale_id);

alter table sale_attachments enable row level security;

create policy sale_attachments_select on sale_attachments
  for select using (company_id in (select my_company_ids()));
-- Adjuntar lo puede hacer quien registra; quitar, solo quien corrige la venta.
create policy sale_attachments_insert on sale_attachments
  for insert with check (company_id in (select my_company_ids()));
create policy sale_attachments_delete on sale_attachments
  for delete using (is_super_admin());

-- ------------------------------------------------------------
-- Las vistas, con la contestada derivada y los tres bloques de atención.
--
-- `create or replace` no deja meter columnas en medio, y `a.*` cambia con la
-- columna nueva: se tiran y se vuelven a crear en orden de dependencia.
-- ------------------------------------------------------------
drop view if exists v_objective_progress;
drop view if exists v_branch_monthly;
drop view if exists v_monthly_activity;
drop view if exists v_daily_activity;

create view v_daily_activity as
select
  a.*,
  c.hora_entrada,
  case when a.hora_llegada is null then null
       else a.hora_llegada > c.hora_entrada end as llego_tarde,

  (a.agenda_confirmada + a.agenda_posible + a.agenda_reprograma
   + a.agenda_no_contesta + a.agenda_cancela) as total_agendas,

  (a.llamada_efectiva + a.llamada_seguimiento + a.llamada_agenda
   + a.llamada_no_interesado + a.llamada_postventa) as llamadas_contestadas,

  (a.llamada_no_contestada + a.llamada_efectiva + a.llamada_seguimiento
   + a.llamada_agenda + a.llamada_no_interesado + a.llamada_postventa) as total_llamadas,

  -- Atención venta presencial: el cliente vino al punto.
  (a.atencion_venta + a.atencion_seguimiento + a.atencion_declinado
   + a.atencion_venta_externa) as total_atencion,

  -- Atención administrativa: no es venta y no todos la hacen.
  (a.atencion_asociado + a.atencion_enrolamiento + a.atencion_certificados
   + a.atencion_renovacion) as total_administrativa,

  (a.chats_inicial - a.chats_final)         as chats_depurados,
  (a.tareas_inicial - a.tareas_final)       as tareas_depuradas,
  (a.caducadas_inicial - a.caducadas_final) as caducadas_depuradas,

  safe_ratio(a.llamada_efectiva,
             a.llamada_efectiva + a.llamada_seguimiento + a.llamada_agenda
             + a.llamada_no_interesado + a.llamada_postventa) as volumen_venta_general,
  safe_ratio(a.llamada_efectiva,
             a.llamada_no_contestada + a.llamada_efectiva + a.llamada_seguimiento
             + a.llamada_agenda + a.llamada_no_interesado + a.llamada_postventa)
             as ratio_conversion_llamada,
  safe_ratio(a.llamada_efectiva + a.llamada_seguimiento + a.llamada_agenda
             + a.llamada_no_interesado + a.llamada_postventa,
             a.llamada_no_contestada + a.llamada_efectiva + a.llamada_seguimiento
             + a.llamada_agenda + a.llamada_no_interesado + a.llamada_postventa)
             as ratio_contactabilidad,
  safe_ratio(a.atencion_agenda,
             a.agenda_confirmada + a.agenda_posible + a.agenda_reprograma
             + a.agenda_no_contesta + a.agenda_cancela) as ratio_conversion_agendas,
  safe_ratio(a.atencion_venta + a.atencion_venta_externa,
             a.atencion_venta + a.atencion_seguimiento + a.atencion_declinado
             + a.atencion_venta_externa) as ratio_venta_presencial
from daily_activity a
join companies c on c.id = a.company_id;

alter view v_daily_activity set (security_invoker = true);

create view v_monthly_activity as
with base as (
  select
    company_id, branch_id, period_month, staff_id,
    max(responsable_nombre) as responsable_nombre,
    count(*) as dias_reportados,
    count(*) filter (where llego_tarde) as dias_tarde,
    sum(total_llamadas)        as total_llamadas,
    sum(llamadas_contestadas)  as llamadas_contestadas,
    sum(llamada_efectiva)      as llamada_efectiva,
    sum(llamada_seguimiento)   as llamada_seguimiento,
    sum(llamada_agenda)        as llamada_agenda,
    sum(total_agendas)         as total_agendas,
    sum(atencion_agenda)       as atencion_agenda,
    sum(total_atencion)        as total_atencion,
    sum(total_administrativa)  as total_administrativa,
    sum(atencion_venta)        as atencion_venta,
    sum(atencion_venta_externa) as atencion_venta_externa,
    sum(atencion_certificados) as atencion_certificados,
    sum(atencion_renovacion)   as atencion_renovacion,
    sum(chats_depurados)       as chats_depurados,
    sum(tareas_depuradas)      as tareas_depuradas
  from v_daily_activity
  group by company_id, branch_id, period_month, staff_id
)
select
  b.*,
  safe_ratio(b.llamada_efectiva, b.llamadas_contestadas) as volumen_venta_general,
  safe_ratio(b.llamada_efectiva, b.total_llamadas)       as ratio_conversion_llamada,
  safe_ratio(b.llamadas_contestadas, b.total_llamadas)   as ratio_contactabilidad,
  safe_ratio(b.atencion_agenda, b.total_agendas)         as ratio_conversion_agendas,
  safe_ratio(b.atencion_venta + b.atencion_venta_externa, b.total_atencion)
                                                         as ratio_venta_presencial,
  safe_ratio(b.dias_tarde, b.dias_reportados)            as ratio_llegadas_tarde
from base b;

alter view v_monthly_activity set (security_invoker = true);

create view v_branch_monthly as
with ventas as (
  select s.company_id, s.branch_id, s.period_month,
         count(*) filter (where not coalesce(cp.is_renovacion, p.is_renovacion, false)) as ventas_mes,
         sum(s.cantidad_final) as licencias_mes,
         sum(s.valor_final)    as facturacion_mes
  from sales s
  left join products p on p.code = s.product_code
  left join company_products cp on cp.id = s.company_product_id
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

create view v_objective_progress as
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

-- ------------------------------------------------------------
-- Indicadores de un rango de fechas, por comercial.
--
-- Una fila por comercial con todo sumado: lo que digitó en la jornada y lo
-- que vendió según la base, separado en presencial y digital. La pantalla
-- filtra comerciales y suma filas para el consolidado; los ratios se rehacen
-- sobre los totales, nunca promediando ratios.
--
-- `security invoker`: la función lee las tablas con los permisos de quien
-- pregunta, así que RLS sigue mandando.
-- ------------------------------------------------------------
create or replace function indicadores_por_comercial(
  p_company uuid,
  p_desde   date,
  p_hasta   date
)
returns table (
  staff_id               uuid,
  responsable_nombre     text,
  dias_laborados         bigint,
  dias_tarde             bigint,
  llamada_no_contestada  bigint,
  llamada_efectiva       bigint,
  llamada_seguimiento    bigint,
  llamada_agenda         bigint,
  llamada_no_interesado  bigint,
  llamada_postventa      bigint,
  llamadas_contestadas   bigint,
  total_llamadas         bigint,
  agenda_confirmada      bigint,
  agenda_posible         bigint,
  agenda_reprograma      bigint,
  agenda_no_contesta     bigint,
  agenda_cancela         bigint,
  total_agendas          bigint,
  atencion_venta         bigint,
  atencion_venta_externa bigint,
  atencion_seguimiento   bigint,
  atencion_declinado     bigint,
  total_atencion         bigint,
  atencion_agenda        bigint,
  atencion_asociado      bigint,
  atencion_enrolamiento  bigint,
  atencion_certificados  bigint,
  atencion_renovacion    bigint,
  total_administrativa   bigint,
  chats_inicial          bigint,
  chats_medio            bigint,
  chats_final            bigint,
  tareas_inicial         bigint,
  tareas_medio           bigint,
  tareas_final           bigint,
  caducadas_inicial      bigint,
  caducadas_medio        bigint,
  caducadas_final        bigint,
  ventas_total           bigint,
  ventas_presencial      bigint,
  ventas_digital         bigint,
  ventas_sin_tipo        bigint,
  valor_final            numeric,
  adicion                numeric,
  descuento              numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with gestion as (
    select
      a.staff_id,
      max(a.responsable_nombre) as responsable_nombre,
      count(*)                                   as dias_laborados,
      count(*) filter (where a.llego_tarde)      as dias_tarde,
      sum(a.llamada_no_contestada) as llamada_no_contestada,
      sum(a.llamada_efectiva)      as llamada_efectiva,
      sum(a.llamada_seguimiento)   as llamada_seguimiento,
      sum(a.llamada_agenda)        as llamada_agenda,
      sum(a.llamada_no_interesado) as llamada_no_interesado,
      sum(a.llamada_postventa)     as llamada_postventa,
      sum(a.llamadas_contestadas)  as llamadas_contestadas,
      sum(a.total_llamadas)        as total_llamadas,
      sum(a.agenda_confirmada)     as agenda_confirmada,
      sum(a.agenda_posible)        as agenda_posible,
      sum(a.agenda_reprograma)     as agenda_reprograma,
      sum(a.agenda_no_contesta)    as agenda_no_contesta,
      sum(a.agenda_cancela)        as agenda_cancela,
      sum(a.total_agendas)         as total_agendas,
      sum(a.atencion_venta)        as atencion_venta,
      sum(a.atencion_venta_externa) as atencion_venta_externa,
      sum(a.atencion_seguimiento)  as atencion_seguimiento,
      sum(a.atencion_declinado)    as atencion_declinado,
      sum(a.total_atencion)        as total_atencion,
      sum(a.atencion_agenda)       as atencion_agenda,
      sum(a.atencion_asociado)     as atencion_asociado,
      sum(a.atencion_enrolamiento) as atencion_enrolamiento,
      sum(a.atencion_certificados) as atencion_certificados,
      sum(a.atencion_renovacion)   as atencion_renovacion,
      sum(a.total_administrativa)  as total_administrativa,
      sum(a.chats_inicial)     as chats_inicial,
      sum(a.chats_medio)       as chats_medio,
      sum(a.chats_final)       as chats_final,
      sum(a.tareas_inicial)    as tareas_inicial,
      sum(a.tareas_medio)      as tareas_medio,
      sum(a.tareas_final)      as tareas_final,
      sum(a.caducadas_inicial) as caducadas_inicial,
      sum(a.caducadas_medio)   as caducadas_medio,
      sum(a.caducadas_final)   as caducadas_final
    from v_daily_activity a
    where a.company_id = p_company
      and a.report_date between p_desde and p_hasta
    group by a.staff_id
  ),
  ventas as (
    select
      s.staff_id,
      max(s.responsable_nombre) as responsable_nombre,
      count(*)                                              as ventas_total,
      count(*) filter (where s.sale_type_code = 'presencial') as ventas_presencial,
      count(*) filter (where s.sale_type_code = 'digital')    as ventas_digital,
      count(*) filter (where s.sale_type_code is null
                          or s.sale_type_code not in ('presencial', 'digital')) as ventas_sin_tipo,
      sum(s.valor_final) as valor_final,
      sum(s.adicion)     as adicion,
      sum(s.descuento)   as descuento
    from sales s
    where s.company_id = p_company
      and s.report_date between p_desde and p_hasta
    group by s.staff_id
  )
  select
    coalesce(g.staff_id, v.staff_id)                       as staff_id,
    coalesce(g.responsable_nombre, v.responsable_nombre, '—') as responsable_nombre,
    coalesce(g.dias_laborados, 0),
    coalesce(g.dias_tarde, 0),
    coalesce(g.llamada_no_contestada, 0),
    coalesce(g.llamada_efectiva, 0),
    coalesce(g.llamada_seguimiento, 0),
    coalesce(g.llamada_agenda, 0),
    coalesce(g.llamada_no_interesado, 0),
    coalesce(g.llamada_postventa, 0),
    coalesce(g.llamadas_contestadas, 0),
    coalesce(g.total_llamadas, 0),
    coalesce(g.agenda_confirmada, 0),
    coalesce(g.agenda_posible, 0),
    coalesce(g.agenda_reprograma, 0),
    coalesce(g.agenda_no_contesta, 0),
    coalesce(g.agenda_cancela, 0),
    coalesce(g.total_agendas, 0),
    coalesce(g.atencion_venta, 0),
    coalesce(g.atencion_venta_externa, 0),
    coalesce(g.atencion_seguimiento, 0),
    coalesce(g.atencion_declinado, 0),
    coalesce(g.total_atencion, 0),
    coalesce(g.atencion_agenda, 0),
    coalesce(g.atencion_asociado, 0),
    coalesce(g.atencion_enrolamiento, 0),
    coalesce(g.atencion_certificados, 0),
    coalesce(g.atencion_renovacion, 0),
    coalesce(g.total_administrativa, 0),
    coalesce(g.chats_inicial, 0),
    coalesce(g.chats_medio, 0),
    coalesce(g.chats_final, 0),
    coalesce(g.tareas_inicial, 0),
    coalesce(g.tareas_medio, 0),
    coalesce(g.tareas_final, 0),
    coalesce(g.caducadas_inicial, 0),
    coalesce(g.caducadas_medio, 0),
    coalesce(g.caducadas_final, 0),
    coalesce(v.ventas_total, 0),
    coalesce(v.ventas_presencial, 0),
    coalesce(v.ventas_digital, 0),
    coalesce(v.ventas_sin_tipo, 0),
    coalesce(v.valor_final, 0),
    coalesce(v.adicion, 0),
    coalesce(v.descuento, 0)
  from gestion g
  -- Las filas sin comercial también se cruzan. `is not distinct from` no
  -- sirve acá: Postgres exige una condición que pueda hacer por hash.
  full join ventas v
    on coalesce(v.staff_id, '00000000-0000-0000-0000-000000000000'::uuid)
     = coalesce(g.staff_id, '00000000-0000-0000-0000-000000000000'::uuid)
$$;

comment on function indicadores_por_comercial is
  'Totales de gestión y de ventas por comercial en un rango de fechas. Alimenta el tablero de indicadores.';

revoke all on function indicadores_por_comercial(uuid, date, date) from public;
grant execute on function indicadores_por_comercial(uuid, date, date) to authenticated;
