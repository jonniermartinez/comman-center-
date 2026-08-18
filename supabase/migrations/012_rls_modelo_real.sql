-- ============================================================
-- RLS de las tablas nuevas.
--
-- Las de captura diaria eran cientos de filas; sales y payments son decenas de
-- miles. Con ese volumen importa como se escribe la politica: llamar
-- has_company_access(company_id) obliga a resolver la funcion contra cada
-- fila. En su lugar se compara contra el conjunto de empresas del usuario,
-- que Postgres evalua una sola vez por consulta.
-- ============================================================
create or replace function my_company_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select cu.company_id
  from company_users cu
  join profiles p on p.id = cu.user_id
  where cu.user_id = (select auth.uid())
    and cu.removed_at is null
    and p.deleted_at is null
    and p.status = 'activo'
  union
  -- El super admin ve todas las empresas.
  select c.id from companies c where is_super_admin();
$$;

revoke all on function my_company_ids() from public, anon;
grant execute on function my_company_ids() to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'staff', 'company_staff',
    'channels', 'ad_categories', 'schools', 'medical_centers',
    'products', 'sale_states', 'sale_types', 'id_types', 'cash_concepts',
    'sales', 'payments', 'cash_movements', 'appointments'
  ]
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end;
$$;

-- Catalogos: los lee cualquier usuario activo, los escribe quien administra.
do $$
declare t text;
begin
  foreach t in array array[
    'channels', 'ad_categories', 'schools', 'medical_centers',
    'products', 'sale_states', 'sale_types', 'id_types', 'cash_concepts'
  ]
  loop
    execute format(
      'create policy %I_select on %I for select using (is_active_user())', t, t);
    execute format(
      'create policy %I_write on %I for all using (is_super_admin()) with check (is_super_admin())', t, t);
  end loop;
end;
$$;

-- ============================================================
-- staff
--
-- Un comercial se ve si se comparte empresa con el. No se abre a todo usuario
-- activo por lo mismo que profiles: la lista completa de quien trabaja en cada
-- empresa cliente es informacion del negocio.
-- ============================================================
create policy staff_select on staff
  for select using (
    is_super_admin()
    or exists (
      select 1 from company_staff cs
      where cs.staff_id = staff.id
        and cs.company_id in (select my_company_ids())
    )
  );

create policy staff_insert on staff
  for insert with check (is_active_user());

create policy staff_update on staff
  for update using (
    is_super_admin()
    or exists (
      select 1 from company_staff cs
      where cs.staff_id = staff.id
        and can_manage_company(cs.company_id)
    )
  );

create policy company_staff_select on company_staff
  for select using (company_id in (select my_company_ids()));

create policy company_staff_write on company_staff
  for all using (can_manage_company(company_id))
  with check (can_manage_company(company_id));

-- ============================================================
-- Ventas, pagos, caja y agendas
--
--   ver      -> quien tiene acceso a la empresa
--   escribir -> quien la gestiona (coordinador o super admin)
--
-- Estas tablas no llevan la excepcion de "el asesor escribe lo suyo" que si
-- tienen los registros diarios: una venta mueve plata y su correccion pasa por
-- alguien que responde por la empresa.
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['sales', 'payments', 'cash_movements', 'appointments']
  loop
    execute format(
      'create policy %I_select on %I for select using (company_id in (select my_company_ids()))', t, t);
    execute format(
      'create policy %I_insert on %I for insert with check (can_manage_company(company_id))', t, t);
    execute format(
      'create policy %I_update on %I for update using (can_manage_company(company_id))
         with check (can_manage_company(company_id))', t, t);
    execute format(
      'create policy %I_delete on %I for delete using (can_manage_company(company_id))', t, t);
  end loop;
end;
$$;
