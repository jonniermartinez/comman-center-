-- ============================================================
-- Command Center · 066 · Las políticas RLS dejan de llamar funciones por fila
--
-- Entre el 23 y el 27 de octubre la app se quedaba cargando en horas de uso.
-- La base (plan gratuito, instancia Nano) se saturaba, y buena parte del
-- trabajo venía de las políticas:
--
-- - `can_manage_company(company_id)`, `has_company_access(company_id)` y
--   compañía reciben la columna de la fila, así que Postgres las ejecuta una
--   vez por fila. Cada llamada es otra consulta a `profiles` y
--   `company_users`.
-- - Las políticas `*_write` son `for all`, y `for all` también aplica al
--   leer. Así que cada SELECT sumaba `can_manage_company` por fila aunque
--   solo se estuviera leyendo.
-- - `is_super_admin()`, `is_active_user()` y compañía no dependen de la fila,
--   pero escritas sueltas Postgres tampoco las guarda: se repiten por fila.
--
-- Medido como un coordinador real con la base tranquila: 23 filas de
-- `company_payment_methods` costaban 192 ms; `company_staff`, 176 ms.
--
-- El arreglo no cambia quién ve qué:
--
-- - Cada función por fila se reemplaza por "la columna está en esta lista",
--   y la lista sale de una función nueva que no depende de la fila. Postgres
--   la calcula una vez por consulta y la busca en un hash.
-- - Cada función sin argumentos va dentro de `( select … )`, que Postgres
--   evalúa una sola vez.
--
-- Las listas replican exactamente las funciones viejas. `company_role` lleva
-- `limit 1`, pero `company_users` tiene llave primaria (company_id, user_id):
-- hay a lo sumo una fila por persona y empresa, así que no hay ambigüedad.
-- Las funciones viejas se quedan: las usan otras funciones y las RPC.
-- ============================================================

-- Cambiar una política toma un candado exclusivo sobre la tabla. Con tráfico
-- en vivo es mejor fallar rápido y reintentar que dejar la app esperando.
set local lock_timeout = '5s';

-- Empresas donde can_manage_company() da verdadero.
create or replace function empresas_que_gestiono()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id from companies c where is_super_admin()
  union
  select cu.company_id
  from company_users cu
  join profiles p on p.id = cu.user_id
  where cu.user_id = (select auth.uid())
    and cu.removed_at is null
    and cu.role = 'coordinador'
    and p.deleted_at is null
    and p.status = 'activo';
$$;

-- Empresas donde puede_editar_ventas() da verdadero.
create or replace function empresas_donde_edito_ventas()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id from companies c where is_super_admin()
  union
  select cu.company_id
  from company_users cu
  join profiles p on p.id = cu.user_id
  where cu.user_id = (select auth.uid())
    and cu.removed_at is null
    and cu.role = 'coordinador'
    and cu.puede_editar
    and p.deleted_at is null
    and p.status = 'activo';
$$;

-- Usuarios con los que shares_company() da verdadero.
create or replace function usuarios_con_quien_comparto()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select theirs.user_id
  from company_users mine
  join company_users theirs on theirs.company_id = mine.company_id
  where mine.user_id = (select auth.uid())
    and mine.removed_at is null
    and theirs.removed_at is null;
$$;

-- Usuarios donde usuario_es_de_prueba() da verdadero.
create or replace function usuarios_de_prueba()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from profiles where es_cuenta_de_prueba(email);
$$;

-- Comerciales donde es_mi_registro() da verdadero.
create or replace function mis_registros()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.id from staff s where s.profile_id = (select auth.uid());
$$;

revoke all on function empresas_que_gestiono() from public, anon;
revoke all on function empresas_donde_edito_ventas() from public, anon;
revoke all on function usuarios_con_quien_comparto() from public, anon;
revoke all on function usuarios_de_prueba() from public, anon;
revoke all on function mis_registros() from public, anon;
grant execute on function empresas_que_gestiono() to authenticated;
grant execute on function empresas_donde_edito_ventas() to authenticated;
grant execute on function usuarios_con_quien_comparto() to authenticated;
grant execute on function usuarios_de_prueba() to authenticated;
grant execute on function mis_registros() to authenticated;

-- ------------------------------------------------------------
-- Las políticas, con la misma lógica de antes
-- ------------------------------------------------------------

alter policy ad_categories_select on ad_categories
  using (( SELECT is_active_user()));

alter policy ad_categories_write on ad_categories
  using (( SELECT is_super_admin()))
  with check (( SELECT is_super_admin()));

alter policy audit_log_select on audit_log
  using ((( SELECT is_super_admin()) AND ((actor_id IS NULL) OR (NOT (actor_id IN ( SELECT usuarios_de_prueba()))) OR ( SELECT ve_cuentas_de_prueba()))));

alter policy branches_insert on branches
  with check ((company_id IN ( SELECT empresas_que_gestiono())));

alter policy branches_select on branches
  using ((company_id IN ( SELECT my_company_ids())));

alter policy branches_update on branches
  using ((company_id IN ( SELECT empresas_que_gestiono())));

alter policy cash_concepts_select on cash_concepts
  using (( SELECT is_active_user()));

alter policy cash_concepts_write on cash_concepts
  using (( SELECT is_super_admin()))
  with check (( SELECT is_super_admin()));

alter policy cash_movements_delete on cash_movements
  using ((company_id IN ( SELECT empresas_que_gestiono())));

alter policy cash_movements_insert on cash_movements
  with check ((company_id IN ( SELECT empresas_que_gestiono())));

alter policy cash_movements_update on cash_movements
  using ((company_id IN ( SELECT empresas_que_gestiono())))
  with check ((company_id IN ( SELECT empresas_que_gestiono())));

alter policy channels_select on channels
  using (( SELECT is_active_user()));

alter policy channels_write on channels
  using (( SELECT is_super_admin()))
  with check (( SELECT is_super_admin()));

alter policy companies_insert on companies
  with check (( SELECT is_super_admin()));

alter policy companies_select on companies
  using ((( SELECT is_super_admin()) OR (id IN ( SELECT my_company_ids()))));

alter policy companies_update on companies
  using (( SELECT is_super_admin()));

alter policy company_ad_spend_delete on company_ad_spend
  using ((company_id IN ( SELECT empresas_que_gestiono())));

alter policy company_ad_spend_insert on company_ad_spend
  with check ((company_id IN ( SELECT empresas_que_gestiono())));

alter policy company_ad_spend_update on company_ad_spend
  using ((company_id IN ( SELECT empresas_que_gestiono())))
  with check ((company_id IN ( SELECT empresas_que_gestiono())));

alter policy company_business_days_delete on company_business_days
  using ((company_id IN ( SELECT empresas_que_gestiono())));

alter policy company_business_days_insert on company_business_days
  with check ((company_id IN ( SELECT empresas_que_gestiono())));

alter policy company_business_days_update on company_business_days
  using ((company_id IN ( SELECT empresas_que_gestiono())))
  with check ((company_id IN ( SELECT empresas_que_gestiono())));

alter policy company_financing_types_select on company_financing_types
  using ((company_id IN ( SELECT my_company_ids())));

alter policy company_financing_types_write on company_financing_types
  using ((company_id IN ( SELECT empresas_que_gestiono())))
  with check ((company_id IN ( SELECT empresas_que_gestiono())));

alter policy company_kpi_targets_delete on company_kpi_targets
  using ((company_id IN ( SELECT empresas_que_gestiono())));

alter policy company_kpi_targets_insert on company_kpi_targets
  with check ((company_id IN ( SELECT empresas_que_gestiono())));

alter policy company_kpi_targets_update on company_kpi_targets
  using ((company_id IN ( SELECT empresas_que_gestiono())))
  with check ((company_id IN ( SELECT empresas_que_gestiono())));

alter policy company_modules_select on company_modules
  using ((company_id IN ( SELECT my_company_ids())));

alter policy company_modules_write on company_modules
  using ((company_id IN ( SELECT empresas_que_gestiono())))
  with check ((company_id IN ( SELECT empresas_que_gestiono())));

alter policy company_payment_methods_select on company_payment_methods
  using ((company_id IN ( SELECT my_company_ids())));

alter policy company_payment_methods_write on company_payment_methods
  using ((company_id IN ( SELECT empresas_que_gestiono())))
  with check ((company_id IN ( SELECT empresas_que_gestiono())));

alter policy company_product_bonuses_write on company_product_bonuses
  using ((company_id IN ( SELECT empresas_que_gestiono())))
  with check ((company_id IN ( SELECT empresas_que_gestiono())));

alter policy company_products_write on company_products
  using ((company_id IN ( SELECT empresas_que_gestiono())))
  with check ((company_id IN ( SELECT empresas_que_gestiono())));

alter policy company_schools_update on company_schools
  using ((company_id IN ( SELECT empresas_que_gestiono())))
  with check ((company_id IN ( SELECT empresas_que_gestiono())));

alter policy company_staff_write on company_staff
  using ((company_id IN ( SELECT empresas_que_gestiono())))
  with check ((company_id IN ( SELECT empresas_que_gestiono())));

alter policy company_staff_horarios_write on company_staff_horarios
  using ((company_id IN ( SELECT empresas_que_gestiono())))
  with check ((company_id IN ( SELECT empresas_que_gestiono())));

alter policy company_users_insert on company_users
  with check ((company_id IN ( SELECT empresas_que_gestiono())));

alter policy company_users_select on company_users
  using (((( SELECT is_super_admin()) OR (company_id IN ( SELECT my_company_ids())) OR (user_id = ( SELECT auth.uid() AS uid))) AND ((NOT (user_id IN ( SELECT usuarios_de_prueba()))) OR (user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT ve_cuentas_de_prueba()))));

alter policy company_users_update on company_users
  using ((company_id IN ( SELECT empresas_que_gestiono())))
  with check ((company_id IN ( SELECT empresas_que_gestiono())));

alter policy daily_activity_delete on daily_activity
  using (((company_id IN ( SELECT empresas_que_gestiono())) OR ((company_id IN ( SELECT my_company_ids() AS my_company_ids)) AND (staff_id IN ( SELECT mis_registros())))));

alter policy daily_activity_insert on daily_activity
  with check (((company_id IN ( SELECT empresas_que_gestiono())) OR (EXISTS ( SELECT 1
   FROM staff s
  WHERE ((s.id = daily_activity.staff_id) AND (s.profile_id = ( SELECT auth.uid() AS uid)))))));

alter policy financing_types_select on financing_types
  using (( SELECT is_active_user()));

alter policy financing_types_write on financing_types
  using (( SELECT is_super_admin()))
  with check (( SELECT is_super_admin()));

alter policy id_types_select on id_types
  using (( SELECT is_active_user()));

alter policy id_types_write on id_types
  using (( SELECT is_super_admin()))
  with check (( SELECT is_super_admin()));

alter policy kommo_eventos_select on kommo_eventos
  using ((company_id IN ( SELECT empresas_que_gestiono())));

alter policy kommo_integrations_select on kommo_integrations
  using ((company_id IN ( SELECT empresas_que_gestiono())));

alter policy medical_centers_select on medical_centers
  using (( SELECT is_active_user()));

alter policy medical_centers_write on medical_centers
  using (( SELECT is_super_admin()))
  with check (( SELECT is_super_admin()));

alter policy metrics_select on metrics
  using (( SELECT is_active_user()));

alter policy metrics_write on metrics
  using (( SELECT is_super_admin()))
  with check (( SELECT is_super_admin()));

alter policy modules_select on modules
  using (( SELECT is_active_user()));

alter policy modules_write on modules
  using (( SELECT is_super_admin()))
  with check (( SELECT is_super_admin()));

alter policy objectives_delete on objectives
  using (((company_id IN ( SELECT empresas_que_gestiono())) AND ((NOT locked) OR ( SELECT is_super_admin()))));

alter policy objectives_insert on objectives
  with check ((company_id IN ( SELECT empresas_que_gestiono())));

alter policy objectives_select on objectives
  using ((company_id IN ( SELECT my_company_ids())));

alter policy objectives_update on objectives
  using (((company_id IN ( SELECT empresas_que_gestiono())) AND ((NOT locked) OR ( SELECT is_super_admin()))));

alter policy payment_methods_select on payment_methods
  using (( SELECT is_active_user()));

alter policy payment_methods_write on payment_methods
  using (( SELECT is_super_admin()))
  with check (( SELECT is_super_admin()));

alter policy payments_delete on payments
  using (((company_id IN ( SELECT empresas_que_gestiono())) OR ((company_id IN ( SELECT my_company_ids() AS my_company_ids)) AND (EXISTS ( SELECT 1
   FROM sales v
  WHERE ((v.id = payments.sale_id) AND (v.staff_id IN ( SELECT mis_registros()))))))));

alter policy payments_insert on payments
  with check (((company_id IN ( SELECT empresas_que_gestiono())) OR ((company_id IN ( SELECT my_company_ids() AS my_company_ids)) AND (EXISTS ( SELECT 1
   FROM sales v
  WHERE ((v.id = payments.sale_id) AND (v.staff_id IN ( SELECT mis_registros()))))))));

alter policy payments_update on payments
  using (((company_id IN ( SELECT empresas_donde_edito_ventas())) OR (EXISTS ( SELECT 1
   FROM sales v
  WHERE ((v.id = payments.sale_id) AND (v.staff_id IN ( SELECT mis_registros())))))))
  with check (((company_id IN ( SELECT empresas_donde_edito_ventas())) OR (EXISTS ( SELECT 1
   FROM sales v
  WHERE ((v.id = payments.sale_id) AND (v.staff_id IN ( SELECT mis_registros())))))));

alter policy products_select on products
  using (( SELECT is_active_user()));

alter policy products_write on products
  using (( SELECT is_super_admin()))
  with check (( SELECT is_super_admin()));

alter policy profiles_select on profiles
  using ((((id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_super_admin()) OR (( SELECT is_active_user()) AND (id IN ( SELECT usuarios_con_quien_comparto())))) AND ((NOT es_cuenta_de_prueba(email)) OR (id = ( SELECT auth.uid() AS uid)) OR ( SELECT ve_cuentas_de_prueba()))));

alter policy profiles_super_admin_insert on profiles
  with check (( SELECT is_super_admin()));

alter policy profiles_super_admin_update on profiles
  using (( SELECT is_super_admin()));

alter policy profiles_update_propio on profiles
  using (((id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_active_user())))
  with check (((id = ( SELECT auth.uid() AS uid)) AND (role = ( SELECT my_role())) AND (status = ( SELECT my_status()))));

alter policy sale_additions_delete on sale_additions
  using (( SELECT is_super_admin()));

alter policy sale_additions_update on sale_additions
  using (( SELECT is_super_admin()))
  with check (( SELECT is_super_admin()));

alter policy sale_attachments_delete on sale_attachments
  using (( SELECT is_super_admin()));

alter policy sale_bonuses_delete on sale_bonuses
  using (( SELECT is_super_admin()));

alter policy sale_bonuses_update on sale_bonuses
  using (( SELECT is_super_admin()))
  with check (( SELECT is_super_admin()));

alter policy sale_financings_delete on sale_financings
  using (( SELECT is_super_admin()));

alter policy sale_financings_update on sale_financings
  using (( SELECT is_super_admin()))
  with check (( SELECT is_super_admin()));

alter policy sale_states_select on sale_states
  using (( SELECT is_active_user()));

alter policy sale_states_write on sale_states
  using (( SELECT is_super_admin()))
  with check (( SELECT is_super_admin()));

alter policy sale_types_select on sale_types
  using (( SELECT is_active_user()));

alter policy sale_types_write on sale_types
  using (( SELECT is_super_admin()))
  with check (( SELECT is_super_admin()));

alter policy sales_delete on sales
  using (( SELECT is_super_admin()));

alter policy sales_insert on sales
  with check (((company_id IN ( SELECT empresas_que_gestiono())) OR ((company_id IN ( SELECT my_company_ids() AS my_company_ids)) AND (staff_id IN ( SELECT mis_registros())))));

alter policy sales_update on sales
  using ((company_id IN ( SELECT empresas_donde_edito_ventas())))
  with check ((company_id IN ( SELECT empresas_donde_edito_ventas())));

alter policy schools_select on schools
  using (( SELECT is_active_user()));

alter policy schools_write on schools
  using (( SELECT is_super_admin()))
  with check (( SELECT is_super_admin()));

alter policy staff_insert on staff
  with check (( SELECT is_active_user()));

alter policy staff_select on staff
  using ((( SELECT is_super_admin()) OR (EXISTS ( SELECT 1
   FROM company_staff cs
  WHERE ((cs.staff_id = staff.id) AND (cs.company_id IN ( SELECT my_company_ids() AS my_company_ids)))))));

alter policy staff_update on staff
  using ((( SELECT is_super_admin()) OR (EXISTS ( SELECT 1
   FROM company_staff cs
  WHERE ((cs.staff_id = staff.id) AND (cs.company_id IN ( SELECT empresas_que_gestiono())))))));

alter policy traffic_sources_select on traffic_sources
  using (( SELECT is_active_user()));

alter policy traffic_sources_write on traffic_sources
  using (( SELECT is_super_admin()))
  with check (( SELECT is_super_admin()));

