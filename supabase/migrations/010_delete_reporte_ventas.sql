-- ============================================================
-- El reporte de ventas del dia se reemplaza completo.
--
-- Guardar borra las lineas de ese dia en esa sede y las vuelve a escribir: el
-- formulario es la unica fuente de verdad de ese dia, asi que una financiacion
-- que quedo en cero tiene que desaparecer, no quedarse como linea vieja.
--
-- Sin politica de DELETE, ese borrado no falla: RLS simplemente no borra nada y
-- el INSERT posterior choca contra el indice unico. Es el unico sitio de la app
-- donde se borran filas de un registro historico, y por eso la politica se
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
