-- ============================================================
-- Row Level Security
--   super_admin -> todo
--   coordinador -> todo lo de las empresas que tiene asignadas
--   asesor      -> lectura de sus empresas, escritura solo de SUS registros
-- Ninguna politica permite DELETE sobre profiles/companies ni sobre los
-- registros historicos: la baja es siempre logica.
-- ============================================================

-- Helpers. SECURITY DEFINER para que consultar profiles/company_users dentro de
-- una politica no dispare las politicas de esas mismas tablas (recursion).
create or replace function is_super_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = (select auth.uid())
      and role = 'super_admin'
      and deleted_at is null
      and status = 'activo'
  );
$$;

create or replace function is_active_user()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = (select auth.uid()) and deleted_at is null and status = 'activo'
  );
$$;

-- Rol y estado propios. Se leen por funcion y no por subconsulta dentro de la
-- politica: una subconsulta a profiles dentro de una politica DE profiles
-- vuelve a evaluar la politica y entra en recursion.
create or replace function my_role()
returns user_role language sql security definer stable set search_path = public as $$
  select role from profiles where id = (select auth.uid());
$$;

create or replace function my_status()
returns user_status language sql security definer stable set search_path = public as $$
  select status from profiles where id = (select auth.uid());
$$;

create or replace function company_role(target_company uuid)
returns user_role language sql security definer stable set search_path = public as $$
  select cu.role
  from company_users cu
  join profiles p on p.id = cu.user_id
  where cu.company_id = target_company
    and cu.user_id = (select auth.uid())
    and cu.removed_at is null
    and p.deleted_at is null
    and p.status = 'activo'
  limit 1;
$$;

create or replace function has_company_access(target_company uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select is_super_admin() or company_role(target_company) is not null;
$$;

-- Nadie puede enumerar los usuarios de la plataforma: solo ves a la gente con
-- la que efectivamente trabajas.
create or replace function shares_company(target_user uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from company_users mine
    join company_users theirs on theirs.company_id = mine.company_id
    where mine.user_id = (select auth.uid())
      and mine.removed_at is null
      and theirs.user_id = target_user
      and theirs.removed_at is null
  );
$$;

create or replace function can_manage_company(target_company uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select is_super_admin() or company_role(target_company) = 'coordinador';
$$;

-- Las vistas deben evaluar RLS con los permisos de quien consulta, no del dueno
-- de la vista (por defecto en Postgres una vista SALTA RLS).
do $$
declare v text;
begin
  foreach v in array array[
    'v_daily_kpi', 'v_monthly_kpi', 'v_daily_management_progress',
    'v_daily_sales', 'v_monthly_sales', 'v_monthly_billing',
    'v_monthly_collection', 'v_monthly_totals', 'v_objective_progress',
    'v_capture_status', 'v_branch_monthly'
  ]
  loop
    execute format('alter view %I set (security_invoker = true)', v);
  end loop;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'companies', 'branches', 'modules', 'company_modules', 'company_users',
    'financing_types', 'company_financing_types',
    'payment_methods', 'company_payment_methods',
    'daily_kpi', 'daily_management',
    'sales_entries', 'billing_entries', 'collection_entries',
    'metrics', 'objectives', 'audit_log'
  ]
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end;
$$;

-- ============================================================
-- profiles
-- Un usuario ve su propio perfil y los de gente con la que comparte empresa.
-- Abrirlo "para mostrar el nombre del responsable" permitiria listar los correos
-- de toda la plataforma; no hace falta, cada registro guarda responsable_nombre.
-- ============================================================
create policy profiles_select on profiles
  for select using (
    id = (select auth.uid())
    or is_super_admin()
    or (is_active_user() and shares_company(id))
  );

create policy profiles_update_propio on profiles
  for update using (id = (select auth.uid()) and is_active_user())
  with check (
    id = (select auth.uid())
    -- nadie se cambia su propio rol ni se resucita a si mismo
    and role = my_role()
    and status = my_status()
  );

create policy profiles_super_admin_insert on profiles
  for insert with check (is_super_admin());

create policy profiles_super_admin_update on profiles
  for update using (is_super_admin());

-- ============================================================
-- companies
-- ============================================================
create policy companies_select on companies
  for select using (is_super_admin() or has_company_access(id));

create policy companies_insert on companies
  for insert with check (is_super_admin());

create policy companies_update on companies
  for update using (is_super_admin());

-- ============================================================
-- branches
-- ============================================================
create policy branches_select on branches
  for select using (has_company_access(company_id));

create policy branches_insert on branches
  for insert with check (can_manage_company(company_id));

create policy branches_update on branches
  for update using (can_manage_company(company_id));

-- ============================================================
-- Catalogos globales: lectura para todo usuario activo, escritura super admin
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['modules', 'financing_types', 'payment_methods', 'metrics']
  loop
    execute format(
      'create policy %I_select on %I for select using (is_active_user())', t, t);
    execute format(
      'create policy %I_write on %I for all using (is_super_admin()) with check (is_super_admin())', t, t);
  end loop;
end;
$$;

-- ============================================================
-- Configuracion por empresa
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'company_modules', 'company_financing_types', 'company_payment_methods'
  ]
  loop
    execute format(
      'create policy %I_select on %I for select using (has_company_access(company_id))', t, t);
    execute format(
      'create policy %I_write on %I for all
         using (can_manage_company(company_id))
         with check (can_manage_company(company_id))', t, t);
  end loop;
end;
$$;

-- ============================================================
-- company_users
-- El coordinador escribe dentro de SU empresa (mover un comercial de sede o
-- cambiarle el rol) porque la UI se lo permite; crear el usuario en si sigue
-- siendo exclusivo del super admin y eso lo controla la tabla profiles.
-- ============================================================
create policy company_users_select on company_users
  for select using (
    is_super_admin() or has_company_access(company_id) or user_id = (select auth.uid())
  );

create policy company_users_insert on company_users
  for insert with check (can_manage_company(company_id));

create policy company_users_update on company_users
  for update using (can_manage_company(company_id))
  with check (can_manage_company(company_id));

-- ============================================================
-- Registros diarios
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['daily_kpi', 'daily_management']
  loop
    execute format(
      'create policy %I_select on %I for select using (has_company_access(company_id))', t, t);
    execute format(
      'create policy %I_insert on %I for insert with check (
         has_company_access(company_id)
         and (can_manage_company(company_id) or user_id = (select auth.uid()))
       )', t, t);
    execute format(
      'create policy %I_update on %I for update using (
         can_manage_company(company_id)
         or (user_id = (select auth.uid()) and has_company_access(company_id))
       )', t, t);
  end loop;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['sales_entries', 'billing_entries', 'collection_entries']
  loop
    execute format(
      'create policy %I_select on %I for select using (has_company_access(company_id))', t, t);
    execute format(
      'create policy %I_insert on %I for insert with check (
         has_company_access(company_id)
         and (can_manage_company(company_id) or user_id = (select auth.uid()))
       )', t, t);
    execute format(
      'create policy %I_update on %I for update using (
         can_manage_company(company_id)
         or (user_id = (select auth.uid()) and has_company_access(company_id))
       )', t, t);
  end loop;
end;
$$;

-- ============================================================
-- objectives
-- ============================================================
create policy objectives_select on objectives
  for select using (has_company_access(company_id));

create policy objectives_insert on objectives
  for insert with check (can_manage_company(company_id));

create policy objectives_update on objectives
  for update using (can_manage_company(company_id) and (not locked or is_super_admin()));

create policy objectives_delete on objectives
  for delete using (can_manage_company(company_id) and (not locked or is_super_admin()));

-- ============================================================
-- audit_log: solo lectura y solo super admin. Se escribe desde el servidor.
-- ============================================================
create policy audit_log_select on audit_log
  for select using (is_super_admin());

-- ============================================================
-- Baja logica de usuario
-- ============================================================
create or replace function soft_delete_user(target_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  actor uuid := (select auth.uid());
begin
  if not is_super_admin() then
    raise exception 'Solo el super admin puede eliminar usuarios';
  end if;
  if target_user = actor then
    raise exception 'No puedes eliminarte a ti mismo';
  end if;

  update profiles
     set status = 'eliminado', deleted_at = now(), deleted_by = actor
   where id = target_user and deleted_at is null;

  update company_users
     set removed_at = now()
   where user_id = target_user and removed_at is null;

  insert into audit_log (actor_id, actor_name, action, entity, entity_id, after)
  select actor, p.full_name, 'delete', 'profiles', target_user::text,
         jsonb_build_object('status', 'eliminado')
  from profiles p where p.id = actor;
end;
$$;

create or replace function restore_user(target_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  actor uuid := (select auth.uid());
begin
  if not is_super_admin() then
    raise exception 'Solo el super admin puede restaurar usuarios';
  end if;

  update profiles
     set status = 'activo', deleted_at = null, deleted_by = null
   where id = target_user and deleted_at is not null;

  insert into audit_log (actor_id, actor_name, action, entity, entity_id, after)
  select actor, p.full_name, 'restore', 'profiles', target_user::text,
         jsonb_build_object('status', 'activo')
  from profiles p where p.id = actor;
end;
$$;
