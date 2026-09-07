-- Sin correo: el super admin define las contraseñas.
--
-- No hay SMTP y no va a haberlo, así que ni invitaciones ni recuperaciones.
-- Las cuentas las crea el super admin desde Admin → Usuarios con nombre,
-- correo y contraseña, y desde ahí mismo le cambia la contraseña a quien la
-- olvide. Con eso se cierra el registro público que abrió la 033: nadie se
-- crea la cuenta solo. Vuelve admin_set_password, que la 027 había quitado
-- porque nada en la aplicación la ofrecía; ahora sí, y queda en la auditoría.
-- ------------------------------------------------------------
drop function if exists claim_account(text, text);

create or replace function admin_set_password(target_user uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not is_super_admin() then
    raise exception 'Solo el super admin puede definir contrasenas';
  end if;
  if length(coalesce(p_password, '')) < 8 then
    raise exception 'La contrasena debe tener al menos 8 caracteres';
  end if;

  update auth.users
     set encrypted_password = crypt(p_password, gen_salt('bf')),
         email_confirmed_at = coalesce(email_confirmed_at, now()),
         updated_at = now()
   where id = target_user;

  if not found then
    raise exception 'La cuenta no existe';
  end if;

  -- Con contraseña ya puede entrar: si seguía como invitado, queda activo.
  update profiles set status = 'activo' where id = target_user and status = 'invitado';
end;
$$;

revoke all on function admin_set_password(uuid, text) from public, anon;
grant execute on function admin_set_password(uuid, text) to authenticated;

-- ------------------------------------------------------------
-- El registro vuelve a ser solo por el super admin (como en la 031). El rol
-- de la metadata solo se respeta con la marca app.alta_autorizada.
-- ------------------------------------------------------------
create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  es_el_primero boolean;
  autorizada    boolean;
  invitado      boolean;
  nombre        text;
  rol           user_role;
begin
  select not exists (select 1 from profiles) into es_el_primero;
  autorizada := coalesce(current_setting('app.alta_autorizada', true), '') = '1';
  invitado   := autorizada and coalesce(new.raw_user_meta_data ->> 'invitado', '') = 'true';

  if not es_el_primero and not autorizada then
    raise exception 'Las cuentas las crea el super admin desde la aplicacion';
  end if;

  nombre := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(new.email, '@', 1)
  );

  rol := case
    when es_el_primero then 'super_admin'::user_role
    when autorizada
     and new.raw_user_meta_data ->> 'role' in ('super_admin', 'coordinador', 'asesor')
      then (new.raw_user_meta_data ->> 'role')::user_role
    else 'asesor'::user_role
  end;

  insert into profiles (id, full_name, email, phone, role, status)
  values (
    new.id,
    nombre,
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    rol,
    case
      when es_el_primero then 'activo'::user_status
      when invitado then 'invitado'::user_status
      when new.email_confirmed_at is not null then 'activo'::user_status
      else 'invitado'::user_status
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
