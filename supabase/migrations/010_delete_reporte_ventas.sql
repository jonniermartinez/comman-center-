-- ============================================================
-- Command Center · 010 · Borrado del reporte de ventas del día
--
-- Guardar el reporte borra las líneas de ese día en esa sede y las vuelve a
-- escribir: el formulario es la única fuente de verdad de ese día, así que una
-- financiación que quedó en cero tiene que desaparecer, no quedarse como línea
-- vieja.
--
-- Sin política de DELETE ese borrado no falla: RLS simplemente no borra nada y
-- el INSERT posterior choca contra el índice único. Es el único sitio de la app
-- donde se borran filas de un registro histórico, y por eso la política se
-- limita a quien ya puede escribir en esa empresa.
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['sales_entries', 'billing_entries', 'collection_entries']
  loop
    execute format(
      'create policy %I_delete on %I for delete using (
         can_manage_company(company_id)
         or (user_id = (select auth.uid()) and has_company_access(company_id))
       )', t, t);
  end loop;
end;
$$;
