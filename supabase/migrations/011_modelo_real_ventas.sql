-- ============================================================
-- Command Center · 011 · El modelo que realmente tiene el Excel
--
-- Los archivos no guardan totales por dia: guardan una fila por venta y una
-- fila por pago, con cliente, producto, escuela, examen medico, valores y
-- saldo. Este bloque crea ese modelo.
-- ============================================================

-- ------------------------------------------------------------
-- Comerciales.
--
-- Son 123 personas en el historico y casi ninguna va a tener login: no pueden
-- ser `profiles`, porque un perfil exige una cuenta en auth.users. `staff` es
-- la persona que aparece como responsable en los registros; `profile_id` la
-- conecta con su cuenta el dia que la tenga.
-- ------------------------------------------------------------
create table staff (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  -- Nombre normalizado (sin tildes, en minuscula) para no duplicar a la misma
  -- persona escrita de dos formas entre archivos.
  slug        text not null unique,
  profile_id  uuid references profiles (id),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table staff is
  'Personas que aparecen como responsables. Existen tengan o no cuenta de acceso: la mayoria del historico son gente que nunca entrara a la aplicacion.';

create index staff_profile_idx on staff (profile_id) where profile_id is not null;

-- La misma persona puede trabajar en varias empresas y sedes: 17 lo hacen.
create table company_staff (
  company_id uuid not null references companies (id) on delete cascade,
  staff_id   uuid not null references staff (id) on delete cascade,
  branch_id  uuid references branches (id),
  primary key (company_id, staff_id)
);

create index company_staff_staff_idx  on company_staff (staff_id);
create index company_staff_branch_idx on company_staff (branch_id);

-- ------------------------------------------------------------
-- Catalogos que salen de los archivos.
--
-- Se llenan con lo que traiga la importacion: el historico esta lleno de
-- variantes de la misma cosa ("Sistecredito"/"Sistecredito", "Interaccion
-- directo"/"Interaccion Directo"), asi que el codigo es el valor normalizado y
-- el nombre es como se muestra.
-- ------------------------------------------------------------
create table channels        (code text primary key, name text not null, sort_order int not null default 0);
create table ad_categories   (code text primary key, name text not null, sort_order int not null default 0);
create table schools         (code text primary key, name text not null, sort_order int not null default 0);
create table medical_centers (code text primary key, name text not null, sort_order int not null default 0);
create table products        (code text primary key, name text not null, sort_order int not null default 0);
create table sale_states     (code text primary key, name text not null, sort_order int not null default 0);
create table sale_types      (code text primary key, name text not null, sort_order int not null default 0);
create table id_types        (code text primary key, name text not null, sort_order int not null default 0);
create table cash_concepts   (code text primary key, name text not null, sort_order int not null default 0);

comment on table channels is 'Canal por el que llego el cliente (Facebook, Whatsapp, Referido...).';
comment on table ad_categories is 'Categoria del anuncio que trajo al cliente.';

-- ------------------------------------------------------------
-- Ventas. Una fila por credito, como en la hoja "Base".
-- ------------------------------------------------------------
create table sales (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies (id) on delete restrict,
  branch_id           uuid not null references branches (id) on delete restrict,

  -- Identificador del Excel: "<id titular> - <id credito> / <fecha>". No es
  -- unico en los archivos (hay creditos repetidos), asi que no es la llave.
  ref_credito         text,
  report_date         date not null,          -- Fecha Solicitud
  period_month        date not null,          -- primer dia del mes, para agregados

  staff_id            uuid references staff (id),
  responsable_nombre  text,

  channel_code        text references channels (code),
  ad_category_code    text references ad_categories (code),
  financing_code      text references financing_types (code),
  sale_type_code      text references sale_types (code),
  product_code        text references products (code),
  school_code         text references schools (code),
  medical_center_code text references medical_centers (code),
  state_code          text references sale_states (code),

  -- Titular de la licencia y titular del credito: no siempre son la misma
  -- persona (un padre financia la licencia de un hijo).
  licencia_tipo_id    text references id_types (code),
  licencia_id         text,
  licencia_nombre     text,
  licencia_celular    text,
  credito_tipo_id     text references id_types (code),
  credito_id          text,
  credito_nombre      text,
  credito_celular     text,

  fecha_certificado   date,
  fecha_legalizacion  date,
  fecha_devolucion    date,
  pagare              text,
  voucher             text,
  contrato            text,
  consecutivo_examen  text,
  evento              text,
  pago_evento         text,
  devolucion_lamina   text,
  cuenta_devolucion   text,
  id_asociado         text,
  id_referido         text,
  documentos          text,
  observacion         text,
  departamento        text,
  ciudad              text,

  valor_inicial       numeric(14,2) not null default 0,
  adicion             numeric(14,2) not null default 0,
  descuento           numeric(14,2) not null default 0,
  valor_final         numeric(14,2) not null default 0,
  recaudo             numeric(14,2) not null default 0,
  saldo               numeric(14,2) not null default 0,
  valor_lamina        numeric(14,2) not null default 0,
  ingreso_neto        numeric(14,2) not null default 0,
  costo_carta         numeric(14,2) not null default 0,
  costo_examen        numeric(14,2) not null default 0,
  total_costo         numeric(14,2) not null default 0,
  cantidad_final      numeric(10,2) not null default 0,
  cantidad_comision   numeric(10,2) not null default 0,
  valor_comision      numeric(14,2) not null default 0,
  total_comision      numeric(14,2) not null default 0,

  -- De donde salio la fila. Permite volver a importar sin tocar lo capturado
  -- en la aplicacion.
  source              text not null default 'app' check (source in ('app', 'excel')),
  source_file         text,
  source_row          int,

  created_by          uuid references profiles (id),
  created_at          timestamptz not null default now(),
  updated_by          uuid references profiles (id),
  updated_at          timestamptz not null default now(),

  constraint sales_period_dia_uno check (date_trunc('month', period_month)::date = period_month)
);

create index sales_company_fecha_idx on sales (company_id, report_date desc);
create index sales_branch_idx        on sales (branch_id, report_date desc);
create index sales_period_idx        on sales (company_id, period_month);
create index sales_staff_idx         on sales (staff_id, report_date desc);
create index sales_ref_idx           on sales (ref_credito) where ref_credito is not null;
create index sales_licencia_id_idx   on sales (licencia_id) where licencia_id is not null;
-- La importacion es idempotente: se reconoce la fila por archivo y numero de
-- linea, asi que volver a correrla corrige en vez de duplicar.
create unique index sales_origen_idx on sales (source_file, source_row)
  where source = 'excel';

-- ------------------------------------------------------------
-- Pagos. Una fila por abono, como en la hoja "Pagos".
-- ------------------------------------------------------------
create table payments (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references companies (id) on delete restrict,
  branch_id          uuid not null references branches (id) on delete restrict,
  -- Se enlaza con la venta cuando la referencia coincide; si no, el pago
  -- igual se guarda: perder plata registrada por no encontrar su venta seria
  -- peor que tenerla suelta.
  sale_id            uuid references sales (id) on delete set null,
  ref_credito        text,

  report_date        date not null,
  period_month       date not null,
  titular_id         text,
  titular_nombre     text,
  amount             numeric(14,2) not null,
  method_code        text references payment_methods (code),
  recibo             text,
  observacion        text,

  source             text not null default 'app' check (source in ('app', 'excel')),
  source_file        text,
  source_row         int,

  created_by         uuid references profiles (id),
  created_at         timestamptz not null default now(),
  updated_by         uuid references profiles (id),
  updated_at         timestamptz not null default now(),

  constraint payments_period_dia_uno check (date_trunc('month', period_month)::date = period_month)
);

create index payments_company_fecha_idx on payments (company_id, report_date desc);
create index payments_branch_idx        on payments (branch_id, report_date desc);
create index payments_sale_idx          on payments (sale_id);
create index payments_ref_idx           on payments (ref_credito) where ref_credito is not null;
create unique index payments_origen_idx on payments (source_file, source_row)
  where source = 'excel';

-- ------------------------------------------------------------
-- Control de ingreso y gasto: movimientos de caja.
-- ------------------------------------------------------------
create table cash_movements (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies (id) on delete restrict,
  branch_id     uuid not null references branches (id) on delete restrict,
  report_date   date not null,
  period_month  date not null,
  -- Entrada suma, salida resta. El signo se guarda en el monto tal como viene
  -- del Excel (las salidas son negativas), y `kind` lo dice explicitamente
  -- para no depender de que el signo este bien digitado.
  kind          text not null check (kind in ('entrada', 'salida')),
  concept_code  text references cash_concepts (code),
  method_code   text references payment_methods (code),
  staff_id      uuid references staff (id),
  responsable_nombre text,
  identificacion text,
  nombre         text,
  factura        text,
  amount         numeric(14,2) not null,
  observacion    text,

  source        text not null default 'app' check (source in ('app', 'excel')),
  source_file   text,
  source_row    int,

  created_by    uuid references profiles (id),
  created_at    timestamptz not null default now(),
  updated_by    uuid references profiles (id),
  updated_at    timestamptz not null default now(),

  constraint cash_period_dia_uno check (date_trunc('month', period_month)::date = period_month)
);

create index cash_company_fecha_idx on cash_movements (company_id, report_date desc);
create index cash_branch_idx        on cash_movements (branch_id);
create index cash_staff_idx         on cash_movements (staff_id);
create unique index cash_origen_idx on cash_movements (source_file, source_row)
  where source = 'excel';

-- ------------------------------------------------------------
-- Agendas: citas concertadas con un cliente.
-- ------------------------------------------------------------
create table appointments (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies (id) on delete restrict,
  branch_id     uuid not null references branches (id) on delete restrict,
  nombre        text,
  celular       text,
  scheduled_at  date not null,
  scheduled_time time,
  staff_id      uuid references staff (id),
  responsable_nombre text,
  -- Venta / Seguimiento 1..3. Se deja como texto libre normalizado: en los
  -- archivos son cuatro valores, pero el equipo los escribe a mano.
  resultado     text,
  observacion   text,

  source        text not null default 'app' check (source in ('app', 'excel')),
  source_file   text,
  source_row    int,

  created_by    uuid references profiles (id),
  created_at    timestamptz not null default now(),
  updated_by    uuid references profiles (id),
  updated_at    timestamptz not null default now()
);

create index appointments_company_fecha_idx on appointments (company_id, scheduled_at desc);
create index appointments_branch_idx        on appointments (branch_id);
create index appointments_staff_idx         on appointments (staff_id);
create unique index appointments_origen_idx on appointments (source_file, source_row)
  where source = 'excel';

-- ------------------------------------------------------------
-- updated_at automatico en lo nuevo
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['staff', 'sales', 'payments', 'cash_movements', 'appointments']
  loop
    execute format(
      'create trigger %I_set_updated_at before update on %I
         for each row execute function set_updated_at()', t, t);
  end loop;
end;
$$;
