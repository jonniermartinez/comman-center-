-- ============================================================
-- Command Center · 061 · Tráfico "Pauta"
--
-- Muchos clientes no escriben: dicen "los vi en Facebook o Instagram" y en el
-- CRM no hay rastro, pero llegaron por la pauta. Esa venta no cabía en
-- Interacción directa, RTG, RMK, Asociados ni Venta interna, y terminaba en
-- "Otro" o sin clasificar.
--
-- Se agrega Pauta como una opción más. "Otro" se queda al final y las ventas
-- ya clasificadas no cambian.
-- ============================================================
insert into traffic_sources (code, name, sort_order) values
  ('pauta', 'Pauta', 6)
on conflict (code) do nothing;

update traffic_sources set sort_order = 7 where code = 'otro';

comment on table traffic_sources is
  'Origen del tráfico de una venta. Siete opciones fijas, no las variantes sueltas del Excel.';
