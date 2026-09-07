-- Vuelve el cambio de correo desde Admin → Usuarios.
--
-- La 027 lo quitó porque nada en la aplicación lo ofrecía. Ahora sí: unas
-- setenta cuentas del equipo nacieron con un correo provisional `.invalid`
-- y la forma de darles acceso es ponerles su correo real y mandarles la
-- recuperación de contraseña de Auth. Cambiar el correo no mueve nada más:
-- la cuenta conserva su identificador, y con él su histórico, sus empresas y
-- sus metas. El perfil se sincroniza solo: on_auth_user_confirmed copia el
-- correo nuevo a profiles cuando cambia en auth.users.
--
-- Solo el super admin, verificado por la base, y queda en la auditoría desde
-- la aplicación.
-- ------------------------------------------------------------
create or replace function admin_change_email(target_user uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  correo text := lower(trim(p_email));
begin
  if not is_super_admin() then
    raise exception 'Solo el super admin puede cambiar correos';
  end if;
  if correo !~ '.+@.+\..+' then
    raise exception 'El correo no es valido';
  end if;
  if exists (select 1 from auth.users where lower(email) = correo and id <> target_user) then
    raise exception 'Ya existe una cuenta con el correo %', correo;
  end if;

  update auth.users
     set email = correo,
         email_confirmed_at = coalesce(email_confirmed_at, now()),
         updated_at = now()
   where id = target_user;

  if not found then
    raise exception 'La cuenta no existe';
  end if;

  update auth.identities
     set identity_data = identity_data || jsonb_build_object('email', correo),
         updated_at = now()
   where user_id = target_user and provider = 'email';
end;
$$;

revoke all on function admin_change_email(uuid, text) from public, anon;
grant execute on function admin_change_email(uuid, text) to authenticated;
