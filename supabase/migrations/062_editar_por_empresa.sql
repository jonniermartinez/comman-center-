-- ============================================================
-- Command Center · 062 · Quién edita se habilita por empresa
--
-- Tres decisiones de la operación (10 de octubre):
--
--  1. Editar una venta guardada deja de ser solo del super admin: lo puede
--     hacer un coordinador a quien el super admin le encienda la casilla, y
--     solo en esa empresa. Apagada por defecto, así que nadie gana permisos
--     por haber corrido esta migración.
--
--  2. Archivar —ventas y pagos— se queda solo en el super admin. Hasta la 059
--     un pago también lo archivaba el coordinador o el dueño de la venta.
--
--  3. El rol de la persona es uno solo: el del perfil. Un coordinador en el
--     sistema es coordinador en cada empresa a la que entra. Antes la
--     asignación a la empresa traía su propio rol, entraba como asesor y el
--     coordinador no podía ni registrar un pago ajeno.
-- ============================================================

-- ------------------------------------------------------------
-- 3 · El rol de la empresa sale del perfil
-- ------------------------------------------------------------
create or replace function company_users_rol_del_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rol user_role;
begin
  select role into rol from profiles where id = new.user_id;

  if rol = 'coordinador' then
    new.role := 'coordinador';
  elsif rol = 'asesor' and new.branch_id is not null then
    -- Un asesor sin sede viola company_users_asesor_con_sede: ahí se respeta lo
    -- que venga y falla la restricción con su propio mensaje.
    new.role := 'asesor';
  end if;

  return new;
end;
$$;

drop trigger if exists company_users_rol_del_perfil on company_users;
create trigger company_users_rol_del_perfil
  before insert or update of role, user_id, branch_id on company_users
  for each row
  execute function company_users_rol_del_perfil();

-- Cuando cambia el rol del perfil, sus asignaciones lo siguen.
create or replace function profiles_rol_a_empresas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update company_users set role = role where user_id = new.id;
  return null;
end;
$$;

drop trigger if exists profiles_rol_a_empresas on profiles;
create trigger profiles_rol_a_empresas
  after update of role on profiles
  for each row
  when (old.role is distinct from new.role)
  execute function profiles_rol_a_empresas();

-- Lo que ya estaba desalineado: coordinadores asignados como asesores.
update company_users set role = role;

-- ------------------------------------------------------------
-- 1 · La casilla
-- ------------------------------------------------------------
alter table company_users
  add column if not exists puede_editar boolean not null default false;

comment on column company_users.puede_editar is
  'Si este coordinador puede corregir ventas ya guardadas en esta empresa. Lo enciende el super admin; el asesor nunca lo usa.';

-- Solo el super admin cambia la casilla: sin esto un coordinador con acceso de
-- escritura a su propia fila se la podría encender.
create or replace function company_users_proteger_casilla()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.puede_editar and not is_super_admin() then
      new.puede_editar := false;
    end if;
  elsif new.puede_editar is distinct from old.puede_editar and not is_super_admin() then
    raise exception 'casilla_solo_super_admin';
  end if;
  return new;
end;
$$;

drop trigger if exists company_users_proteger_casilla on company_users;
create trigger company_users_proteger_casilla
  before insert or update of puede_editar on company_users
  for each row
  execute function company_users_proteger_casilla();

create or replace function puede_editar_ventas(target_company uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_super_admin() or exists (
    select 1
    from company_users cu
    join profiles p on p.id = cu.user_id
    where cu.company_id = target_company
      and cu.user_id = (select auth.uid())
      and cu.removed_at is null
      and cu.role = 'coordinador'
      and cu.puede_editar
      and p.deleted_at is null
      and p.status = 'activo'
  );
$$;

drop policy if exists sales_update on sales;
create policy sales_update on sales
  for update
  using (puede_editar_ventas(company_id))
  with check (puede_editar_ventas(company_id));

-- ------------------------------------------------------------
-- 2 · Archivar y restaurar, solo el super admin
--
-- `sales_update` ahora deja pasar al coordinador habilitado, y archivar es un
-- update: este guardia es lo que mantiene cerrada esa puerta.
-- ------------------------------------------------------------
create or replace function sales_proteger_archivado()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not is_super_admin() then
    raise exception 'archivar_sin_permiso';
  end if;
  return new;
end;
$$;

drop trigger if exists sales_proteger_archivado on sales;
create trigger sales_proteger_archivado
  before update of archived_at on sales
  for each row
  when (old.archived_at is distinct from new.archived_at)
  execute function sales_proteger_archivado();

create or replace function payments_proteger_archivado()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not is_super_admin() then
    raise exception 'archivar_sin_permiso';
  end if;

  if new.archived_at is null and exists (
    select 1 from sales v where v.id = new.sale_id and v.archived_at is not null
  ) then
    raise exception 'venta_archivada';
  end if;

  return new;
end;
$$;
