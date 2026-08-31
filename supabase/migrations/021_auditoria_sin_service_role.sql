-- ============================================================
-- La auditoria se escribe con la sesion del usuario, no con service_role.
--
-- `audit_log` solo tiene politica de SELECT, asi que la aplicacion la escribia
-- con la clave de servicio, que salta RLS entera para insertar una fila. Es un
-- precio desproporcionado: basta una funcion `security definer` —el mismo
-- patron que ya usan soft_delete_user, restore_user y delete_company_cascade—
-- para que el insert ocurra sin abrirle a nadie la tabla.
--
-- De paso deja de ser falsificable: el actor sale de auth.uid(), no de lo que
-- mande la aplicacion. Antes, quien pudiera llamar a la Server Action decidia
-- que nombre quedaba firmado en el log.
-- ============================================================

create or replace function log_audit(
  p_action     text,
  p_entity     text,
  p_entity_id  text  default null,
  p_company_id uuid  default null,
  p_before     jsonb default null,
  p_after      jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor  uuid := (select auth.uid());
  nombre text;
begin
  select full_name into nombre
    from profiles
   where id = actor and deleted_at is null and status = 'activo';

  if nombre is null then
    raise exception 'Sin perfil activo: no se puede escribir en la auditoria';
  end if;

  -- Solo escribe quien administra: con empresa, quien la administra; sin
  -- empresa, el super admin o un coordinador. Sin esta puerta cualquier sesion
  -- podria llenar el log de ruido, que es justo lo que lo vuelve inutil.
  if p_company_id is not null then
    if not can_manage_company(p_company_id) then
      raise exception 'Sin permiso sobre la empresa';
    end if;
  elsif not (
    is_super_admin()
    or exists (
      select 1 from company_users
       where user_id = actor and role = 'coordinador' and removed_at is null
    )
  ) then
    raise exception 'Sin permiso para escribir en la auditoria';
  end if;

  insert into audit_log (
    actor_id, actor_name, action, entity, entity_id, company_id, before, after
  )
  values (
    actor, nombre, p_action, p_entity, p_entity_id, p_company_id, p_before, p_after
  );
end;
$$;

revoke all on function log_audit(text, text, text, uuid, jsonb, jsonb) from public, anon;
grant execute on function log_audit(text, text, text, uuid, jsonb, jsonb) to authenticated;
