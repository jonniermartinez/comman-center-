-- ============================================================
-- Command Center · 019 · El comercial registra lo suyo
--
-- Las ventas, los pagos y las agendas solo los podía escribir quien administra
-- la empresa. Es al revés de como trabaja el equipo: la venta la hace el
-- comercial y es él quien la registra, igual que hoy en el Excel. Obligar a que
-- un coordinador transcriba lo de doce personas es garantizar que el dato
-- llegue tarde y con errores.
--
-- Sigue habiendo diferencia con el rol de gestión: el comercial escribe lo
-- suyo, el coordinador escribe y corrige lo de toda la empresa.
--
-- La caja (`cash_movements`) no entra: es el dinero físico del punto y quien
-- responde por él es quien administra.
-- ============================================================
create or replace function es_mi_registro(target_staff uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from staff s
    where s.id = target_staff
      and s.profile_id = (select auth.uid())
  );
$$;

revoke all on function es_mi_registro(uuid) from public, anon;
grant execute on function es_mi_registro(uuid) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['sales', 'payments', 'appointments']
  loop
    execute format('drop policy if exists %I_insert on %I', t, t);
    execute format('drop policy if exists %I_update on %I', t, t);
  end loop;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['sales', 'appointments']
  loop
    execute format(
      'create policy %I_insert on %I for insert with check (
         can_manage_company(company_id)
         or (company_id in (select my_company_ids()) and es_mi_registro(staff_id))
       )', t, t);
    execute format(
      'create policy %I_update on %I for update using (
         can_manage_company(company_id)
         or (company_id in (select my_company_ids()) and es_mi_registro(staff_id))
       ) with check (
         can_manage_company(company_id)
         or (company_id in (select my_company_ids()) and es_mi_registro(staff_id))
       )', t, t);
  end loop;
end;
$$;

-- Un pago no lleva responsable propio: cuelga de una venta. El comercial puede
-- registrar el abono de una venta suya; el coordinador, el de cualquiera.
create policy payments_insert on payments
  for insert with check (
    can_manage_company(company_id)
    or (
      company_id in (select my_company_ids())
      and exists (
        select 1 from sales v
        where v.id = payments.sale_id and es_mi_registro(v.staff_id)
      )
    )
  );

create policy payments_update on payments
  for update using (
    can_manage_company(company_id)
    or (
      company_id in (select my_company_ids())
      and exists (
        select 1 from sales v
        where v.id = payments.sale_id and es_mi_registro(v.staff_id)
      )
    )
  );
