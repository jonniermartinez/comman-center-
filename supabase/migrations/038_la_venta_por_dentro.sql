-- ============================================================
-- Command Center · 038 · La venta por dentro
--
-- Una venta no es una línea con un valor. En el punto pasa esto:
--
--   * La licencia es de una persona y el crédito lo firma otra. Un padre
--     financia el curso del hijo y el que aparece en la financiera no es el
--     que va a manejar. Las columnas ya existían desde la 011; lo que faltaba
--     era capturarlas.
--   * La financiación es mixta más veces de las que el catálogo admite:
--     "Mixta Addi" no dice cuánto puso Addi, cuánto fue de contado, cuál fue
--     la cuota ni quién firmó cada parte.
--   * El precio de lista baja por un bono autorizado y sube por adiciones
--     posteriores. Hoy eso se resumía en dos números sueltos —descuento y
--     adición— sin decir de dónde salieron.
--
-- Cada una de esas tres cosas pasa a ser una lista de líneas colgada de la
-- venta. Los totales siguen viviendo en `sales`: es lo que leen los tableros
-- y lo que ya cuadra con los pagos.
-- ============================================================

-- ------------------------------------------------------------
-- De dónde viene el tráfico de la venta.
--
-- No es lo mismo que `channels`, que trae catorce variantes heredadas del
-- Excel ("Trámites Cartago", "Tramitador", "Whatsapp"). Esto es la
-- clasificación con la que el negocio mide de dónde salen las ventas, y son
-- seis.
-- ------------------------------------------------------------
create table traffic_sources (
  code       text primary key,
  name       text not null,
  sort_order int not null default 0
);

comment on table traffic_sources is
  'Origen del tráfico de una venta. Seis opciones fijas, no las variantes sueltas del Excel.';

insert into traffic_sources (code, name, sort_order) values
  ('interaccion_directa', 'Interacción directa', 1),
  ('rtg_interaccion',     'RTG interacción',     2),
  ('rmk_crm',             'RMK CRM',             3),
  ('asociados',           'Asociados',           4),
  ('venta_interna',       'Venta interna',       5),
  ('otro',                'Otro',                6)
on conflict (code) do nothing;

alter table sales
  add column traffic_code text references traffic_sources (code);

comment on column sales.traffic_code is
  'Origen del tráfico. Las ventas importadas del Excel no lo tienen: ahí solo hay channel_code.';

create index sales_traffic_idx on sales (company_id, traffic_code)
  where traffic_code is not null;

-- ------------------------------------------------------------
-- Financiación mixta: una línea por cada forma de pago.
--
-- `sales.financing_code` se queda como el titular del resumen —es lo que
-- agrupan los tableros— y estas filas cuentan el detalle. Una venta de
-- contado no tiene ninguna; una mixta tiene dos o tres.
-- ------------------------------------------------------------
create table sale_financings (
  id              uuid primary key default gen_random_uuid(),
  sale_id         uuid not null references sales (id) on delete cascade,
  company_id      uuid not null references companies (id) on delete cascade,
  financing_code  text references financing_types (code),

  -- Cuánto se financió por esta vía, cuánto abonó al firmar y de a cuánto
  -- queda la cuota.
  valor           numeric(14,2) not null default 0 check (valor >= 0),
  abono           numeric(14,2) not null default 0 check (abono >= 0),
  cuota           numeric(14,2) not null default 0 check (cuota >= 0),

  -- Quién firma esta parte. Puede no ser el de la licencia ni el de las otras
  -- líneas: eso es justamente lo que hace mixta a una financiación.
  titular_tipo_id text references id_types (code),
  titular_id      text,
  titular_nombre  text,
  titular_celular text,

  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  created_by      uuid references profiles (id)
);

comment on table sale_financings is
  'Detalle de una financiación mixta: qué parte puso cada entidad, con su abono, su cuota y su titular.';

create index sale_financings_sale_idx on sale_financings (sale_id, sort_order);

-- ------------------------------------------------------------
-- Bonos aplicados a la venta.
--
-- El nombre y el valor se copian del catálogo en vez de leerse por la
-- referencia: si mañana la empresa sube el bono de 100.000 a 150.000, la
-- venta de ayer tiene que seguir diciendo 100.000. `bonus_id` queda para
-- saber cuál era, y se pone en null si el bono se borra.
-- ------------------------------------------------------------
create table sale_bonuses (
  id         uuid primary key default gen_random_uuid(),
  sale_id    uuid not null references sales (id) on delete cascade,
  company_id uuid not null references companies (id) on delete cascade,
  bonus_id   uuid references company_product_bonuses (id) on delete set null,
  name       text not null,
  amount     numeric(14,2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  created_by uuid references profiles (id)
);

comment on table sale_bonuses is
  'Bonos autorizados aplicados a una venta. Restan del precio de lista y `sales.descuento` es su suma.';

create index sale_bonuses_sale_idx on sale_bonuses (sale_id);

-- ------------------------------------------------------------
-- Adiciones.
--
-- Lo que se le suma al valor de lista: un curso extra, un examen, un trámite.
-- `sales.adicion` es la suma de estas líneas.
-- ------------------------------------------------------------
create table sale_additions (
  id         uuid primary key default gen_random_uuid(),
  sale_id    uuid not null references sales (id) on delete cascade,
  company_id uuid not null references companies (id) on delete cascade,
  concepto   text not null,
  amount     numeric(14,2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  created_by uuid references profiles (id)
);

comment on table sale_additions is
  'Lo que se le suma al valor de lista de una venta, con su concepto. `sales.adicion` es su suma.';

create index sale_additions_sale_idx on sale_additions (sale_id);

-- ------------------------------------------------------------
-- RLS.
--
-- El catálogo de tráfico se lee como todos los demás y solo lo toca el super
-- admin.
--
-- Las tres listas de detalle se escriben en el mismo momento que la venta, así
-- que insertarlas la puede hacer cualquiera de la empresa —si no, no se podría
-- guardar una venta—. Corregirlas o borrarlas, no: eso es editar una venta ya
-- registrada y esa puerta la cierra la 039. Los totales, que es lo que mueve
-- plata, viven en `sales` y están bajo esa misma llave.
-- ------------------------------------------------------------
alter table traffic_sources enable row level security;

create policy traffic_sources_select on traffic_sources
  for select using (is_active_user());

create policy traffic_sources_write on traffic_sources
  for all using (is_super_admin()) with check (is_super_admin());

do $$
declare t text;
begin
  foreach t in array array['sale_financings', 'sale_bonuses', 'sale_additions']
  loop
    execute format('alter table %I enable row level security', t);

    execute format(
      'create policy %I_select on %I for select
         using (company_id in (select my_company_ids()))', t, t);

    execute format(
      'create policy %I_insert on %I for insert
         with check (company_id in (select my_company_ids()))', t, t);

    execute format(
      'create policy %I_update on %I for update
         using (is_super_admin()) with check (is_super_admin())', t, t);

    execute format(
      'create policy %I_delete on %I for delete using (is_super_admin())', t, t);
  end loop;
end;
$$;
