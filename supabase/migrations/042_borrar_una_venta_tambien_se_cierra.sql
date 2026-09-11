-- ============================================================
-- Command Center · 042 · Borrar una venta también se cierra
--
-- La 039 dejó que solo el super admin corrigiera una venta guardada y dejó
-- borrar como estaba: lo suyo cada comercial, lo de la empresa el coordinador.
-- Eso convertía el bloqueo en un adorno. Quien quisiera cambiar una cifra no
-- tenía que pedir permiso: borraba la venta y la volvía a crear con el número
-- que quería, y en el listado no queda ni la sombra de que existió otra.
--
-- Una venta firmada no se edita ni se borra. El precio que se cobró, quién
-- financió y cuánto quedó debiendo son el soporte de una comisión y de una
-- cartera: si se pueden hacer desaparecer, no son soporte de nada.
--
-- Lo que esto cuesta, dicho sin adornos: el comercial que se equivocó al
-- digitar ya no lo arregla solo. Tiene que pedirlo. Es el precio de que la
-- cifra valga, y la auditoría guarda quién pidió qué.
--
-- Las jornadas, las agendas y los movimientos de caja no se tocan: ahí borrar
-- lo propio sigue siendo parte del trabajo del día.
-- ============================================================
drop policy if exists sales_delete on sales;

create policy sales_delete on sales
  for delete
  using (is_super_admin());
