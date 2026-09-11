-- ============================================================
-- Command Center · 043 · Una financiación mixta se declara, no se adivina
--
-- El formulario decidía si pedir el reparto mirando si el código empezaba por
-- "mixt". Funcionaba con las siete variantes que dejó el Excel —mixto, mixta_addi,
-- mixto_brilla…— y se rompía sola el día que alguien creara "Combinada" o
-- "Addi + contado": el comercial no vería dónde escribir el reparto y la venta
-- quedaría sin decir quién puso cada parte.
--
-- El catálogo dice de sí mismo si es mixta. Las siete de ahora quedan marcadas
-- por su código, que es lo único que hay hoy para reconocerlas; de ahí en
-- adelante es un dato que se administra, no una cadena que se compara.
-- ============================================================
alter table financing_types
  add column if not exists es_mixta boolean not null default false;

comment on column financing_types.es_mixta is
  'La venta se pagó por más de una vía y hay que capturar el reparto: qué puso cada entidad, con su abono, su cuota y su titular.';

update financing_types
   set es_mixta = true
 where code like 'mixt%';
