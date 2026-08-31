-- ============================================================
-- El comercial tambien borra lo suyo.
--
-- La 019 dejo que el comercial registrara y corrigiera lo suyo, porque la venta
-- la hace el y es el quien la captura. Pero el borrado se quedo como estaba:
-- solo can_manage_company. El resultado era incoherente —podia crear una venta
-- y editarla entera, pero no quitarla si la metio por error— y empujaba a la
-- chapuza de dejarla en cero en vez de borrarla, que ensucia los informes.
--
-- Ahora el borrado sigue exactamente la misma regla que el alta: cada quien
-- borra lo suyo, y quien administra la empresa borra lo de cualquiera. Nadie
-- toca lo de otra persona.
--
-- La caja sigue fuera, por el mismo motivo que en la 019: es el dinero fisico
-- del punto y responde quien administra, no quien vende.
-- ============================================================

-- La 023 le dio a la jornada un borrado solo para administradores; se rehace
-- aqui con la regla completa.
drop policy if exists daily_activity_delete on daily_activity;

do $$
declare t text;
begin
  foreach t in array array['sales', 'appointments', 'daily_activity']
  loop
    execute format('drop policy if exists %I_delete on %I', t, t);
    execute format(
      'create policy %I_delete on %I for delete using (
         can_manage_company(company_id)
         or (company_id in (select my_company_ids()) and es_mi_registro(staff_id))
       )', t, t);
  end loop;
end;
$$;

-- Un pago no lleva responsable propio: cuelga de una venta. El comercial puede
-- quitar el abono de una venta suya; el coordinador, el de cualquiera.
drop policy if exists payments_delete on payments;
create policy payments_delete on payments
  for delete using (
    can_manage_company(company_id)
    or (
      company_id in (select my_company_ids())
      and exists (
        select 1 from sales v
        where v.id = payments.sale_id and es_mi_registro(v.staff_id)
      )
    )
  );
