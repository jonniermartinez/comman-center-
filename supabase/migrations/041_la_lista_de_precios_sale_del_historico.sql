-- ============================================================
-- Command Center · 041 · La lista de precios sale del histórico
--
-- La 037 creó el catálogo por empresa y lo dejó vacío, con lo cual cada
-- oficina abría su pantalla de Productos y no veía nada, mientras sus mil
-- ventas seguían colgando del catálogo global. La lista no hay que inventarla:
-- ya está escrita en el histórico, oficina por oficina.
--
-- De cada empresa se saca qué vendió y a cómo:
--
--   * El nombre y si es renovación vienen del catálogo viejo.
--   * El precio es el valor que más se repite en sus ventas del último año.
--     No es un promedio: el promedio de una lista con descuentos da una cifra
--     que nadie cobró nunca, y la moda es literalmente el precio de lista.
--     Sin ventas recientes se usa el valor más repetido de toda su historia.
--   * Queda archivado lo que no vende hace más de un año. Sigue estando para
--     que sus ventas viejas lo nombren, pero no estorba al registrar hoy.
--
-- Y cada venta importada queda enganchada a su producto. A partir de acá el
-- comercial elige de la lista y el precio aparece solo; lo que esté mal se
-- corrige en la pantalla, que para eso está.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Un producto por cada cosa que la empresa haya vendido.
-- ------------------------------------------------------------
with vendidos as (
  select
    s.company_id,
    s.product_code,
    count(*)             as ventas,
    max(s.report_date)   as ultima
  from sales s
  where s.product_code is not null
    -- Dos códigos del Excel no son productos sino números que se colaron en
    -- la columna equivocada al importar ("66703122.0"). No se suben a la
    -- lista de nadie.
    and s.product_code !~ '^[0-9_]+$'
  group by 1, 2
),
precios as (
  select
    s.company_id,
    s.product_code,
    mode() within group (order by s.valor_inicial)
      filter (where s.valor_inicial > 0 and s.report_date >= current_date - 365) as reciente,
    mode() within group (order by s.valor_inicial)
      filter (where s.valor_inicial > 0)                                          as historico
  from sales s
  where s.product_code is not null
  group by 1, 2
)
insert into company_products
  (company_id, name, price, is_renovacion, catalog_code, active, sort_order)
select
  v.company_id,
  p.name,
  coalesce(pr.reciente, pr.historico, 0),
  coalesce(p.is_renovacion, false),
  v.product_code,
  v.ultima >= current_date - 365,
  row_number() over (partition by v.company_id order by v.ventas desc)
from vendidos v
join products p on p.code = v.product_code
left join precios pr
  on pr.company_id = v.company_id and pr.product_code = v.product_code
-- Si alguien ya creó ese producto a mano, manda el suyo.
where not exists (
  select 1 from company_products cp
  where cp.company_id = v.company_id and lower(cp.name) = lower(p.name)
);

-- ------------------------------------------------------------
-- 2. Las ventas quedan enganchadas a su producto.
--
-- El trigger de `updated_at` se apaga durante el enganche: esto no es alguien
-- corrigiendo mil quinientas ventas, y dejar todas con fecha de hoy borraría
-- el único rastro de cuándo se tocó cada una de verdad.
-- ------------------------------------------------------------
alter table sales disable trigger sales_set_updated_at;

update sales s
   set company_product_id = cp.id
  from company_products cp
 where cp.company_id = s.company_id
   and cp.catalog_code = s.product_code
   and s.company_product_id is null;

alter table sales enable trigger sales_set_updated_at;
