-- ============================================================
-- Corregir lo de un companero si; borrarlo no.
--
-- Hasta ahora editar y borrar seguian la misma regla: cada quien lo suyo. En la
-- practica eso frena el trabajo del dia: quien esta en el punto ve el error de
-- un companero que ya se fue y no puede arreglarlo, asi que el dato se queda
-- mal hasta que aparezca un coordinador.
--
-- Se separan las dos cosas, que no son igual de graves:
--
--   * CORREGIR lo de otro: si. Cualquiera de la empresa. El dato sigue estando,
--     sigue a nombre de quien lo hizo, y si el cambio esta mal se vuelve a
--     corregir. La auditoria guarda el rastro.
--   * BORRAR lo de otro: no. Solo lo suyo, o quien administra la empresa. Un
--     borrado no deja nada que revisar despues.
--
-- CREAR sigue como estaba: a nombre propio. Corregir un registro existente es
-- una cosa; firmar uno nuevo por otra persona es otra.
--
-- La caja queda fuera otra vez, por lo mismo que en la 019: es el dinero
-- fisico del punto y responde quien administra.
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['sales', 'appointments', 'daily_activity']
  loop
    execute format('drop policy if exists %I_update on %I', t, t);
    execute format(
      'create policy %I_update on %I for update
         using (company_id in (select my_company_ids()))
         with check (company_id in (select my_company_ids()))', t, t);
  end loop;
end;
$$;

-- Un pago cuelga de una venta, pero para corregirlo basta con ser de la
-- empresa: si se puede tocar la venta, se puede tocar su abono.
drop policy if exists payments_update on payments;
create policy payments_update on payments
  for update
  using (company_id in (select my_company_ids()))
  with check (company_id in (select my_company_ids()));
