-- ============================================================
-- Command Center · 037 · Los productos son de cada empresa
--
-- Hasta ahora el catálogo de productos era uno solo para las catorce empresas
-- —A2, B1, Ren C1— y sin precio: el comercial digitaba el valor de cada venta
-- a mano. Dos oficinas que venden la misma categoría a precios distintos no
-- caben en esa lista, y un precio escrito a mano es un precio que cualquiera
-- puede bajar sin que nadie lo autorice.
--
-- Cada empresa arma el suyo: nombre, precio y los bonos que ella autoriza. El
-- comercial elige producto y, si aplica, un bono de la lista; el valor sale de
-- ahí y no de su criterio.
--
-- El catálogo viejo no se toca. Las dieciséis mil ventas importadas siguen
-- colgando de `products.code`, y de esa tabla sale `is_renovacion`, que es lo
-- que separa una venta nueva de una renovación en todos los tableros. El
-- producto de empresa trae el suyo y las vistas miran ese primero.
-- ============================================================

-- ------------------------------------------------------------
-- La lista de precios de la empresa.
-- ------------------------------------------------------------
create table company_products (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies (id) on delete cascade,
  name          text not null,
  price         numeric(14,2) not null default 0 check (price >= 0),

  -- Una renovación no es una venta nueva: los tableros las cuentan aparte y
  -- las metas se miden por separado.
  is_renovacion boolean not null default false,

  -- Amarre opcional con el catálogo histórico. Sirve para que una empresa
  -- pueda decir "mi Curso A2 es el A2 de siempre" y los reportes que cruzan
  -- todas las oficinas sigan cuadrando. No es obligatorio: una empresa puede
  -- vender algo que el Excel nunca tuvo.
  catalog_code  text references products (code),

  active        boolean not null default true,
  sort_order    int not null default 0,

  created_at    timestamptz not null default now(),
  created_by    uuid references profiles (id),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references profiles (id)
);

comment on table company_products is
  'Lista de precios de cada empresa cliente. Es lo que el comercial elige al registrar una venta.';

-- Dos productos con el mismo nombre en la misma empresa es un error de dedo,
-- no dos productos.
create unique index company_products_nombre_idx
  on company_products (company_id, lower(name));
create index company_products_company_idx
  on company_products (company_id, sort_order, name);

-- ------------------------------------------------------------
-- Los bonos que la empresa autoriza sobre un producto.
--
-- Un bono resta: es un descuento aprobado de antemano y con nombre, para que
-- la rebaja quede explicada. `company_id` va repetido a propósito —se puede
-- sacar del producto— porque es lo que deja escribir la política de RLS sin
-- un subselect en cada fila.
-- ------------------------------------------------------------
create table company_product_bonuses (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references company_products (id) on delete cascade,
  company_id uuid not null references companies (id) on delete cascade,
  name       text not null,
  amount     numeric(14,2) not null check (amount >= 0),
  active     boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table company_product_bonuses is
  'Descuentos autorizados sobre un producto. El comercial aplica uno de estos; no inventa la rebaja.';

create index company_product_bonuses_producto_idx
  on company_product_bonuses (product_id, sort_order, name);

-- ------------------------------------------------------------
-- La venta apunta al producto de su empresa.
--
-- `product_code` se queda: es lo único que tienen las filas importadas y
-- todavía alimenta los reportes históricos.
-- ------------------------------------------------------------
alter table sales
  add column company_product_id uuid references company_products (id);

create index sales_company_product_idx
  on sales (company_product_id) where company_product_id is not null;

comment on column sales.company_product_id is
  'Producto de la lista de la empresa. Las ventas importadas del Excel no tienen: esas van por product_code.';

-- ------------------------------------------------------------
-- RLS: lo lee la empresa, lo escribe quien la administra.
-- ------------------------------------------------------------
alter table company_products        enable row level security;
alter table company_product_bonuses enable row level security;

create policy company_products_select on company_products
  for select using (company_id in (select my_company_ids()));

create policy company_products_write on company_products
  for all using (can_manage_company(company_id))
  with check (can_manage_company(company_id));

create policy company_product_bonuses_select on company_product_bonuses
  for select using (company_id in (select my_company_ids()));

create policy company_product_bonuses_write on company_product_bonuses
  for all using (can_manage_company(company_id))
  with check (can_manage_company(company_id));

-- ------------------------------------------------------------
-- Los tableros aprenden a mirar el producto de la empresa.
--
-- La regla es la misma de siempre —una renovación no cuenta como venta— pero
-- ahora el dato puede venir de dos sitios: del producto de la empresa si la
-- venta se registró en la aplicación, o del catálogo viejo si vino del Excel.
-- ------------------------------------------------------------
create or replace view v_daily_sales as
select
  s.company_id,
  s.branch_id,
  s.report_date,
  count(*) filter (where not coalesce(cp.is_renovacion, p.is_renovacion, false)) as ventas,
  count(*) filter (where     coalesce(cp.is_renovacion, p.is_renovacion, false)) as renovaciones,
  sum(s.cantidad_final)                                                          as licencias,
  sum(s.valor_final)                                                             as facturacion,
  sum(s.recaudo)                                                                 as recaudo_venta,
  sum(s.saldo)                                                                   as saldo,
  sum(s.valor_comision)                                                          as comision
from sales s
left join products p on p.code = s.product_code
left join company_products cp on cp.id = s.company_product_id
group by s.company_id, s.branch_id, s.report_date;

alter view v_daily_sales set (security_invoker = true);

create or replace view v_monthly_sales_by_financing as
select
  s.company_id,
  s.branch_id,
  s.period_month,
  s.financing_code,
  f.name as financing_name,
  count(*) filter (where not coalesce(cp.is_renovacion, p.is_renovacion, false)) as ventas,
  count(*) filter (where     coalesce(cp.is_renovacion, p.is_renovacion, false)) as renovaciones,
  sum(s.cantidad_final)                                                          as licencias,
  sum(s.valor_final)                                                             as facturacion
from sales s
left join products p on p.code = s.product_code
left join company_products cp on cp.id = s.company_product_id
left join financing_types f on f.code = s.financing_code
group by s.company_id, s.branch_id, s.period_month, s.financing_code, f.name;

alter view v_monthly_sales_by_financing set (security_invoker = true);

create or replace view v_monthly_totals as
with ventas as (
  select s.company_id, s.period_month,
         count(*) filter (where not coalesce(cp.is_renovacion, p.is_renovacion, false)) as ventas_mes,
         count(*) filter (where     coalesce(cp.is_renovacion, p.is_renovacion, false)) as renovaciones_mes,
         sum(s.cantidad_final) as licencias_mes,
         sum(s.valor_final)    as facturacion_mes
  from sales s
  left join products p on p.code = s.product_code
  left join company_products cp on cp.id = s.company_product_id
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

create or replace view v_branch_monthly as
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
