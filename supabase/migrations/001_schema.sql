-- ============================================================
-- Command Center · 001 · Schema base
-- Correr en el SQL Editor de Supabase (o psql) en este orden:
--   001_schema.sql → 002_views.sql → 003_rls.sql → 004_seed.sql
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------
create type user_role     as enum ('super_admin', 'coordinador', 'asesor');
create type user_status    as enum ('invitado', 'activo', 'inactivo', 'eliminado');
create type company_status as enum ('activa', 'archivada');
create type jornada        as enum ('inicial', 'medio_dia', 'final');
create type venta_kind     as enum ('venta', 'renovacion');

-- ------------------------------------------------------------
-- Usuarios (extiende auth.users)
-- Nunca se hace DELETE: la baja es soft (deleted_at) para que los
-- registros históricos conserven el nombre del responsable.
-- ------------------------------------------------------------
create table profiles (
  id           uuid        primary key references auth.users (id) on delete restrict,
  full_name    text        not null,
  email        text        not null unique,
  phone        text,
  role         user_role   not null default 'asesor',
  status       user_status not null default 'invitado',
  deleted_at   timestamptz,
  deleted_by   uuid        references profiles (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint profiles_deleted_coherente check (
    (status = 'eliminado' and deleted_at is not null) or
    (status <> 'eliminado' and deleted_at is null)
  )
);

comment on table profiles is
  'Perfiles de usuario. Baja lógica únicamente: al eliminar se marca deleted_at y se revoca el acceso, pero la fila permanece para que los reportes históricos sigan mostrando el nombre.';

create index profiles_activos_idx on profiles (full_name) where deleted_at is null;

-- ------------------------------------------------------------
-- Empresas = clientes de la operadora (Ruta Segura, LV Unión, …)
-- ------------------------------------------------------------
create table companies (
  id            uuid           primary key default gen_random_uuid(),
  name          text           not null,
  slug          text           not null unique,
  nit           text,
  -- Municipio y departamento. El departamento hace falta porque hay nombres de
  -- municipio repetidos en Colombia (Armenia, Caldas, Granada, La Victoria…).
  city          text,
  department    text,
  logo_url      text,
  accent_color  text           not null default '#1e293b',
  crm_label     text,                       -- nombre del CRM que usa (ej. 'LV Unión')
  status        company_status not null default 'activa',
  archived_at   timestamptz,
  created_by    uuid           references profiles (id),
  created_at    timestamptz    not null default now(),
  updated_at    timestamptz    not null default now(),
  constraint companies_archivada_coherente check (
    (status = 'archivada' and archived_at is not null) or
    (status <> 'archivada' and archived_at is null)
  ),
  constraint companies_slug_formato check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

comment on table companies is
  'Empresas cliente. Se archivan, nunca se borran, para preservar el histórico.';

-- ------------------------------------------------------------
-- Sedes
-- Una empresa opera en una o varias sedes. Los comerciales se asignan a una
-- sede y cada registro queda atado a ella, así el dashboard de la empresa es
-- la suma de sus sedes y además se puede desglosar.
-- ------------------------------------------------------------
create table branches (
  id          uuid           primary key default gen_random_uuid(),
  company_id  uuid           not null references companies (id) on delete restrict,
  name        text           not null,
  city        text,
  department  text,
  -- Sede por defecto de la empresa: la usan los registros a nivel de empresa.
  is_primary  boolean        not null default false,
  status      company_status not null default 'activa',
  created_by  uuid           references profiles (id),
  created_at  timestamptz    not null default now(),
  updated_at  timestamptz    not null default now(),
  unique (company_id, name)
);

comment on table branches is
  'Sedes de una empresa cliente. Se archivan, nunca se borran.';

create index branches_company_idx on branches (company_id) where status = 'activa';

-- Una sola sede principal por empresa.
create unique index branches_una_principal_idx
  on branches (company_id) where is_primary;

-- ------------------------------------------------------------
-- Catálogo de módulos y habilitación por empresa
-- ------------------------------------------------------------
create table modules (
  code        text primary key,
  name        text not null,
  description text,
  sort_order  int  not null default 0
);

create table company_modules (
  company_id  uuid not null references companies (id) on delete cascade,
  module_code text not null references modules (code),
  enabled_by  uuid references profiles (id),
  enabled_at  timestamptz not null default now(),
  primary key (company_id, module_code)
);

-- ------------------------------------------------------------
-- Asignación de usuarios a empresas
-- ------------------------------------------------------------
create table company_users (
  company_id  uuid      not null references companies (id) on delete cascade,
  user_id     uuid      not null references profiles (id),
  -- Sede del comercial. NULL = coordinador que supervisa la empresa completa.
  branch_id   uuid      references branches (id),
  role        user_role not null default 'asesor',
  assigned_by uuid      references profiles (id),
  assigned_at timestamptz not null default now(),
  removed_at  timestamptz,
  primary key (company_id, user_id),
  constraint company_users_role_valido check (role in ('coordinador', 'asesor')),
  -- Un asesor siempre registra en una sede; solo el coordinador puede no tenerla.
  constraint company_users_asesor_con_sede check (role <> 'asesor' or branch_id is not null)
);

create index company_users_branch_idx on company_users (branch_id) where removed_at is null;

comment on column company_users.removed_at is
  'Desasignación lógica: el usuario deja de ver la empresa pero sus registros previos siguen atados a ella.';

-- ------------------------------------------------------------
-- Catálogos comerciales (globales) y su activación por empresa
-- ------------------------------------------------------------
create table financing_types (
  code       text primary key,
  name       text not null,
  sort_order int  not null default 0
);

create table company_financing_types (
  company_id    uuid not null references companies (id) on delete cascade,
  financing_code text not null references financing_types (code),
  active        boolean not null default true,
  sort_order    int     not null default 0,
  primary key (company_id, financing_code)
);

create table payment_methods (
  code       text primary key,
  name       text not null,
  sort_order int  not null default 0
);

create table company_payment_methods (
  company_id  uuid not null references companies (id) on delete cascade,
  method_code text not null references payment_methods (code),
  active      boolean not null default true,
  sort_order  int     not null default 0,
  primary key (company_id, method_code)
);

-- ============================================================
-- MÓDULO 1 · KPI Diario
-- Un registro por empresa + fecha + responsable + jornada.
-- Los ratios NO se guardan: se calculan en v_daily_kpi (002_views.sql).
-- ============================================================
create table daily_kpi (
  id                    uuid        primary key default gen_random_uuid(),
  company_id            uuid        not null references companies (id) on delete restrict,
  branch_id             uuid        not null references branches (id) on delete restrict,
  report_date           date        not null,
  user_id               uuid        not null references profiles (id),
  responsable_nombre    text        not null,  -- snapshot: el reporte histórico no cambia si renombran el perfil
  jornada               jornada     not null default 'final',

  llamadas_realizadas   int         not null default 0 check (llamadas_realizadas   >= 0),
  llamadas_contestadas  int         not null default 0 check (llamadas_contestadas  >= 0),
  ventas_efectivas      int         not null default 0 check (ventas_efectivas      >= 0),
  agendas_dia           int         not null default 0 check (agendas_dia           >= 0),
  atencion_agendas      int         not null default 0 check (atencion_agendas      >= 0),
  clientes_atendidos    int         not null default 0 check (clientes_atendidos    >= 0),
  ventas_exitosas       int         not null default 0 check (ventas_exitosas       >= 0),
  llamada_agenda        int         not null default 0 check (llamada_agenda        >= 0),

  notas                 text,
  created_by            uuid        references profiles (id),
  created_at            timestamptz not null default now(),
  updated_by            uuid        references profiles (id),
  updated_at            timestamptz not null default now(),

  unique (company_id, branch_id, report_date, user_id, jornada),
  constraint dk_contestadas     check (llamadas_contestadas <= llamadas_realizadas),
  constraint dk_agendas         check (atencion_agendas     <= agendas_dia),
  constraint dk_presencial      check (ventas_exitosas      <= clientes_atendidos)
);

create index daily_kpi_empresa_fecha_idx on daily_kpi (company_id, report_date desc);
create index daily_kpi_user_fecha_idx    on daily_kpi (user_id, report_date desc);

-- ============================================================
-- MÓDULO 2 · Gestión Diaria (CRM)
-- ============================================================
create table daily_management (
  id                  uuid        primary key default gen_random_uuid(),
  company_id          uuid        not null references companies (id) on delete restrict,
  branch_id           uuid        not null references branches (id) on delete restrict,
  report_date         date        not null,
  user_id             uuid        not null references profiles (id),
  responsable_nombre  text        not null,
  jornada             jornada     not null default 'final',

  chats_por_responder int         not null default 0 check (chats_por_responder >= 0),
  tareas_del_dia      int         not null default 0 check (tareas_del_dia      >= 0),
  tareas_caducadas    int         not null default 0 check (tareas_caducadas    >= 0),
  certificados        int         not null default 0 check (certificados        >= 0),

  notas               text,
  created_by          uuid        references profiles (id),
  created_at          timestamptz not null default now(),
  updated_by          uuid        references profiles (id),
  updated_at          timestamptz not null default now(),

  unique (company_id, branch_id, report_date, user_id, jornada)
);

create index daily_management_empresa_fecha_idx on daily_management (company_id, report_date desc);

-- ============================================================
-- MÓDULO 3 · Reporte de Ventas
-- Tres tablas de líneas. El reporte mensual es la suma de los diarios,
-- nunca se digita (ver v_monthly_sales en 002_views.sql).
-- user_id es NULLable: facturación y recaudo hoy se reportan a nivel
-- de empresa ("Responsable: Todo" en el Excel).
-- ============================================================
create table sales_entries (
  id                  uuid        primary key default gen_random_uuid(),
  company_id          uuid        not null references companies (id) on delete restrict,
  branch_id           uuid        not null references branches (id) on delete restrict,
  report_date         date        not null,
  user_id             uuid        references profiles (id),
  responsable_nombre  text,
  financing_code      text        not null references financing_types (code),
  kind                venta_kind  not null default 'venta',

  ventas              int         not null default 0 check (ventas    >= 0),
  licencias           int         not null default 0 check (licencias >= 0),

  created_by          uuid        references profiles (id),
  created_at          timestamptz not null default now(),
  updated_by          uuid        references profiles (id),
  updated_at          timestamptz not null default now()
);

-- Una línea por combinación. COALESCE porque user_id puede ser null.
create unique index sales_entries_unica_idx
  on sales_entries (company_id, branch_id, report_date, financing_code, kind,
                    coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index sales_entries_empresa_fecha_idx on sales_entries (company_id, report_date desc);

create table billing_entries (
  id                 uuid        primary key default gen_random_uuid(),
  company_id         uuid        not null references companies (id) on delete restrict,
  branch_id          uuid        not null references branches (id) on delete restrict,
  report_date        date        not null,
  user_id            uuid        references profiles (id),
  responsable_nombre text,
  financing_code     text        not null references financing_types (code),
  amount             numeric(14,2) not null default 0 check (amount >= 0),

  created_by         uuid        references profiles (id),
  created_at         timestamptz not null default now(),
  updated_by         uuid        references profiles (id),
  updated_at         timestamptz not null default now()
);

create unique index billing_entries_unica_idx
  on billing_entries (company_id, branch_id, report_date, financing_code,
                      coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index billing_entries_empresa_fecha_idx on billing_entries (company_id, report_date desc);

create table collection_entries (
  id                 uuid        primary key default gen_random_uuid(),
  company_id         uuid        not null references companies (id) on delete restrict,
  branch_id          uuid        not null references branches (id) on delete restrict,
  report_date        date        not null,
  user_id            uuid        references profiles (id),
  responsable_nombre text,
  method_code        text        not null references payment_methods (code),
  amount             numeric(14,2) not null default 0 check (amount >= 0),

  created_by         uuid        references profiles (id),
  created_at         timestamptz not null default now(),
  updated_by         uuid        references profiles (id),
  updated_at         timestamptz not null default now()
);

create unique index collection_entries_unica_idx
  on collection_entries (company_id, branch_id, report_date, method_code,
                         coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index collection_entries_empresa_fecha_idx on collection_entries (company_id, report_date desc);

-- ============================================================
-- Objetivos comerciales
-- Por empresa + mes + métrica, y opcionalmente por usuario.
-- user_id null = meta de la empresa completa.
-- ============================================================
create table metrics (
  code        text primary key,
  name        text not null,
  unit        text not null check (unit in ('cantidad', 'moneda', 'porcentaje')),
  sort_order  int  not null default 0
);

create table objectives (
  id            uuid          primary key default gen_random_uuid(),
  company_id    uuid          not null references companies (id) on delete cascade,
  period_month  date          not null,  -- siempre el día 1 del mes
  metric_code   text          not null references metrics (code),
  user_id       uuid          references profiles (id),
  target_value  numeric(14,2) not null check (target_value >= 0),
  locked        boolean       not null default false,

  created_by    uuid          references profiles (id),
  created_at    timestamptz   not null default now(),
  updated_by    uuid          references profiles (id),
  updated_at    timestamptz   not null default now(),

  constraint objectives_dia_uno check (date_trunc('month', period_month)::date = period_month)
);

create unique index objectives_unica_idx
  on objectives (company_id, period_month, metric_code,
                 coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ============================================================
-- Auditoría
-- ============================================================
create table audit_log (
  id          bigserial   primary key,
  actor_id    uuid        references profiles (id),
  actor_name  text,
  action      text        not null,          -- 'create' | 'update' | 'delete' | 'restore' | 'assign' | ...
  entity      text        not null,          -- nombre de la tabla
  entity_id   text,
  company_id  uuid        references companies (id),
  before      jsonb,
  after       jsonb,
  created_at  timestamptz not null default now()
);

create index audit_log_entity_idx  on audit_log (entity, entity_id, created_at desc);
create index audit_log_company_idx on audit_log (company_id, created_at desc);

-- ============================================================
-- updated_at automático
-- ============================================================
create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'companies', 'branches', 'daily_kpi', 'daily_management',
    'sales_entries', 'billing_entries', 'collection_entries', 'objectives'
  ]
  loop
    execute format(
      'create trigger %I_set_updated_at before update on %I
         for each row execute function set_updated_at()', t, t);
  end loop;
end;
$$;

-- ============================================================
-- Snapshot del nombre del responsable
-- Garantiza que el histórico conserve el nombre incluso si el
-- perfil se renombra o se elimina.
-- ============================================================
create or replace function fill_responsable_nombre()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.user_id is not null and (new.responsable_nombre is null or new.responsable_nombre = '') then
    select full_name into new.responsable_nombre from profiles where id = new.user_id;
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'daily_kpi', 'daily_management',
    'sales_entries', 'billing_entries', 'collection_entries'
  ]
  loop
    execute format(
      'create trigger %I_fill_responsable before insert or update on %I
         for each row execute function fill_responsable_nombre()', t, t);
  end loop;
end;
$$;

-- ============================================================
-- No permitir registros nuevos a nombre de un usuario eliminado
-- ============================================================
create or replace function reject_deleted_responsable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.user_id is not null
     and exists (select 1 from profiles where id = new.user_id and deleted_at is not null) then
    raise exception 'El usuario % está eliminado y no puede recibir registros nuevos', new.user_id;
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'daily_kpi', 'daily_management',
    'sales_entries', 'billing_entries', 'collection_entries'
  ]
  loop
    execute format(
      'create trigger %I_reject_deleted before insert on %I
         for each row execute function reject_deleted_responsable()', t, t);
  end loop;
end;
$$;

-- ============================================================
-- No se registran fechas futuras.
--
-- Va en un trigger y no en un CHECK: `current_date` es STABLE, no IMMUTABLE,
-- y Postgres rechaza funciones no inmutables dentro de una restricción CHECK
-- (una restricción tiene que dar el mismo resultado siempre, y "hoy" cambia).
-- ============================================================
create or replace function reject_future_date()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.report_date > current_date then
    raise exception 'No se puede registrar la fecha futura %', new.report_date;
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'daily_kpi', 'daily_management',
    'sales_entries', 'billing_entries', 'collection_entries'
  ]
  loop
    execute format(
      'create trigger %I_reject_future before insert or update on %I
         for each row execute function reject_future_date()', t, t);
  end loop;
end;
$$;
