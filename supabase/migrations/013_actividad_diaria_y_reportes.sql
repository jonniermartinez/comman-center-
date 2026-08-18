-- ============================================================
-- Command Center · 013 · La captura diaria como está en el Excel
--
-- Dos correcciones de fondo sobre el modelo anterior:
--
-- 1. "KPI Diario" y "Gestión Diaria" no son dos formularios: son una sola hoja
--    del Excel. La misma fila lleva la hora de llegada, la cola de trabajo en
--    tres momentos del día, las agendas por estado, las llamadas por tipo y
--    las atenciones. Se unifican en `daily_activity`, una fila por persona y
--    día. El comparativo inicial/final deja de necesitar dos registros y una
--    vista: son columnas de la misma fila.
--
-- 2. El "Reporte de Ventas" no se captura, se calcula. En el Excel es una hoja
--    de fórmulas sobre Base y Pagos. Guardar totales por financiación al lado
--    de las ventas que los producen es garantizar que un día no cuadren, así
--    que las tablas de totales desaparecen y el reporte pasa a ser vistas.
-- ============================================================

drop view if exists v_objective_progress;
drop view if exists v_branch_monthly;
drop view if exists v_capture_status;
drop view if exists v_monthly_totals;
drop view if exists v_monthly_collection;
drop view if exists v_monthly_billing;
drop view if exists v_monthly_sales;
drop view if exists v_daily_sales;
drop view if exists v_daily_management_progress;
drop view if exists v_monthly_kpi;
drop view if exists v_daily_kpi;
drop view if exists v_user_activity;

drop table if exists collection_entries;
drop table if exists billing_entries;
drop table if exists sales_entries;
drop table if exists daily_management;
drop table if exists daily_kpi;

-- ------------------------------------------------------------
-- Actividad diaria: una fila por empresa + sede + fecha + persona.
-- ------------------------------------------------------------
create table daily_activity (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references companies (id) on delete restrict,
  branch_id          uuid not null references branches (id) on delete restrict,
  report_date        date not null,
  period_month       date not null,
  staff_id           uuid not null references staff (id),
  responsable_nombre text not null,

  -- Jornada. De acá sale el KPI de llegadas tarde.
  hora_llegada       time,
  hora_salida        time,

  -- Cola de trabajo del CRM en los tres momentos del día.
  chats_inicial      int not null default 0 check (chats_inicial     >= 0),
  chats_medio        int not null default 0 check (chats_medio       >= 0),
  chats_final        int not null default 0 check (chats_final       >= 0),
  tareas_inicial     int not null default 0 check (tareas_inicial    >= 0),
  tareas_medio       int not null default 0 check (tareas_medio      >= 0),
  tareas_final       int not null default 0 check (tareas_final      >= 0),
  caducadas_inicial  int not null default 0 check (caducadas_inicial >= 0),
  caducadas_medio    int not null default 0 check (caducadas_medio   >= 0),
  caducadas_final    int not null default 0 check (caducadas_final   >= 0),

  -- Agendas por estado.
  agenda_confirmada  int not null default 0 check (agenda_confirmada >= 0),
  agenda_posible     int not null default 0 check (agenda_posible    >= 0),
  agenda_reprograma  int not null default 0 check (agenda_reprograma >= 0),
  agenda_no_contesta int not null default 0 check (agenda_no_contesta>= 0),
  agenda_cancela     int not null default 0 check (agenda_cancela    >= 0),

  -- Llamadas por resultado.
  llamada_no_contestada int not null default 0 check (llamada_no_contestada >= 0),
  llamada_efectiva      int not null default 0 check (llamada_efectiva      >= 0),
  llamada_seguimiento   int not null default 0 check (llamada_seguimiento   >= 0),
  llamada_agenda        int not null default 0 check (llamada_agenda        >= 0),
  llamada_no_interesado int not null default 0 check (llamada_no_interesado >= 0),
  llamada_contestada    int not null default 0 check (llamada_contestada    >= 0),
  llamada_postventa     int not null default 0 check (llamada_postventa     >= 0),

  -- Atenciones presenciales por resultado.
  atencion_venta        int not null default 0 check (atencion_venta        >= 0),
  atencion_seguimiento  int not null default 0 check (atencion_seguimiento  >= 0),
  atencion_declinado    int not null default 0 check (atencion_declinado    >= 0),
  atencion_asociado     int not null default 0 check (atencion_asociado     >= 0),
  atencion_enrolamiento int not null default 0 check (atencion_enrolamiento >= 0),
  atencion_certificados int not null default 0 check (atencion_certificados >= 0),
  atencion_agenda       int not null default 0 check (atencion_agenda       >= 0),
  atencion_renovacion   int not null default 0 check (atencion_renovacion   >= 0),

  notas              text,

  source             text not null default 'app' check (source in ('app', 'excel')),
  source_file        text,
  source_row         int,

  created_by         uuid references profiles (id),
  created_at         timestamptz not null default now(),
  updated_by         uuid references profiles (id),
  updated_at         timestamptz not null default now(),

  unique (company_id, branch_id, report_date, staff_id),
  constraint daily_activity_periodo check (date_trunc('month', period_month)::date = period_month)
);

comment on table daily_activity is
  'Una fila por persona y día: jornada, cola del CRM en tres momentos, agendas, llamadas y atenciones. Reemplaza a daily_kpi y daily_management, que partían en dos lo que en el Excel es una sola hoja.';

create index daily_activity_company_fecha_idx on daily_activity (company_id, report_date desc);
create index daily_activity_branch_idx        on daily_activity (branch_id, report_date desc);
create index daily_activity_staff_idx         on daily_activity (staff_id, report_date desc);
create index daily_activity_period_idx        on daily_activity (company_id, period_month);
create unique index daily_activity_origen_idx on daily_activity (source_file, source_row)
  where source = 'excel';

create trigger daily_activity_set_updated_at before update on daily_activity
  for each row execute function set_updated_at();

create trigger daily_activity_reject_future before insert or update on daily_activity
  for each row execute function reject_future_date();

alter table daily_activity enable row level security;

create policy daily_activity_select on daily_activity
  for select using (company_id in (select my_company_ids()));

-- Acá sí vale la excepción del asesor: es su propia jornada la que registra.
create policy daily_activity_insert on daily_activity
  for insert with check (
    can_manage_company(company_id)
    or exists (
      select 1 from staff s
      where s.id = staff_id and s.profile_id = (select auth.uid())
    )
  );

create policy daily_activity_update on daily_activity
  for update using (
    can_manage_company(company_id)
    or exists (
      select 1 from staff s
      where s.id = staff_id and s.profile_id = (select auth.uid())
    )
  );
