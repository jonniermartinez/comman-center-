-- ============================================================
-- Borrar de verdad una cuenta de pruebas.
--
-- En este sistema los usuarios no se borran: `soft_delete_user` los marca
-- eliminados y revoca el acceso, porque el historico tiene que seguir
-- mostrando quien hizo cada cosa. Es la regla correcta para las personas
-- reales.
--
-- Para las cuentas que crean las pruebas automatizadas es justo lo contrario:
-- si solo se marcan, se acumulan para siempre en la pantalla de usuarios del
-- cliente, decenas cada semana, mezcladas con su gente. Ya pasaron diez en una
-- tarde.
--
-- Esta funcion las borra de verdad, y solo a ellas. Dos cerrojos:
--
--   * quien la llama tiene que ser super admin;
--   * el correo tiene que encajar con el patron de las cuentas de prueba.
--
-- Cualquier otra direccion —incluida la de una persona real que se llamara
-- parecido— hace saltar la excepcion. No hay forma de usar esto para
-- deshacerse de un usuario del cliente.
-- ============================================================
create or replace function purge_test_user(target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  correo text;
begin
  if not is_super_admin() then
    raise exception 'Solo el super admin puede purgar cuentas de prueba';
  end if;

  select email into correo from auth.users where id = target_user;
  if correo is null then
    return;
  end if;

  -- El cerrojo que hace que esto sea seguro tener en produccion.
  if correo !~ '^e2e[_-][a-z0-9_.-]+@jonnier\.com$' then
    raise exception 'Solo se purgan cuentas de prueba, y % no lo es', correo;
  end if;

  -- Lo que cuelga de la persona se suelta antes: el historico de la empresa
  -- sigue teniendo sentido aunque la cuenta desaparezca.
  update staff set profile_id = null where profile_id = target_user;
  delete from company_users where user_id = target_user;
  update audit_log set actor_id = null where actor_id = target_user;

  delete from profiles where id = target_user;
  delete from auth.identities where user_id = target_user;
  delete from auth.sessions where user_id = target_user;
  delete from auth.users where id = target_user;
end;
$$;

revoke all on function purge_test_user(uuid) from public, anon;
grant execute on function purge_test_user(uuid) to authenticated;
