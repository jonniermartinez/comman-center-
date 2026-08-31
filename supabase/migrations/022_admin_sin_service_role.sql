-- ============================================================
-- Administracion de cuentas sin service_role.
--
-- La clave de servicio salta RLS entera, y este proyecto se rige por lo
-- contrario: la unica llave que viaja es la publicable y la base decide con
-- politicas. Lo que la aplicacion hacia con la Admin API de Auth —crear
-- cuentas, cambiar correo, poner clave temporal, bloquear el login— pasa a
-- funciones `security definer` guardadas por is_super_admin(): el mismo patron
-- de soft_delete_user y delete_company_cascade. Se llaman con la sesion del
-- usuario y la clave publicable; quien no es super admin recibe una excepcion
-- de Postgres, no un "no" de la interfaz.
-- ============================================================

-- ------------------------------------------------------------
-- Alta solo autorizada.
--
-- El trigger de auth.users creaba el perfil confiando en la metadata, lo que
-- era seguro unicamente porque el unico camino de alta era la Admin API con la
-- clave de servicio. Ese camino ya no existe, asi que el trigger ahora exige
-- que el alta venga de admin_create_user —que marca la transaccion— o que sea
-- el primer usuario de la instalacion. Un signUp publico contra GoTrue muere
-- aca con "solo por invitacion".
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
  nombre        text;
  rol           user_role;
begin
  select not exists (select 1 from profiles) into es_el_primero;
  autorizada := coalesce(current_setting('app.alta_autorizada', true), '') = '1';

  if not es_el_primero and not autorizada then
    raise exception 'El registro es solo por invitacion del super admin';
  end if;

  nombre := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(new.email, '@', 1)
  );

  rol := case
    when es_el_primero then 'super_admin'::user_role
    when new.raw_user_meta_data ->> 'role' in ('super_admin', 'coordinador', 'asesor')
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
      when new.email_confirmed_at is not null then 'activo'::user_status
      else 'invitado'::user_status
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- Crear una cuenta.
--
-- Inserta directo en auth.users + auth.identities, que es lo que hacia GoTrue
-- del otro lado de la Admin API. Con p_confirmado la cuenta nace lista para
-- entrar (cuentas provisionales del equipo, cuyo correo no existe); sin el,
-- nace invitada y se activa cuando la persona canjea el enlace del correo.
-- Sin contrasena se le pone una aleatoria imposible de adivinar: nadie entra
-- hasta que la defina.
-- ------------------------------------------------------------
create or replace function admin_create_user(
  p_email      text,
  p_full_name  text,
  p_role       user_role default 'asesor',
  p_password   text      default null,
  p_phone      text      default null,
  p_confirmado boolean   default false
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid    uuid := gen_random_uuid();
  correo text := lower(trim(p_email));
begin
  if not is_super_admin() then
    raise exception 'Solo el super admin puede crear cuentas';
  end if;
  if correo !~ '.+@.+\..+' then
    raise exception 'El correo no es valido';
  end if;
  if exists (select 1 from auth.users where lower(email) = correo) then
    raise exception 'Ya existe una cuenta con el correo %', correo;
  end if;

  -- La marca que el trigger exige: este alta viene de un super admin.
  perform set_config('app.alta_autorizada', '1', true);

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token,
    email_change, email_change_token_new, email_change_token_current
  )
  values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    correo,
    crypt(coalesce(nullif(p_password, ''), encode(gen_random_bytes(32), 'hex')), gen_salt('bf')),
    case when p_confirmado then now() end,
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_strip_nulls(jsonb_build_object(
      'full_name', trim(p_full_name),
      'role',      p_role::text,
      'phone',     nullif(trim(coalesce(p_phone, '')), '')
    )),
    now(), now(),
    -- GoTrue espera cadena vacia, no null, en las columnas de tokens.
    '', '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, provider, identity_data,
    last_sign_in_at, created_at, updated_at
  )
  values (
    gen_random_uuid(), uid, uid::text, 'email',
    jsonb_build_object('sub', uid::text, 'email', correo, 'email_verified', p_confirmado),
    now(), now(), now()
  );

  return uid;
end;
$$;

-- ------------------------------------------------------------
-- Cambiar el correo de una cuenta (cuando llega el real de alguien que entro
-- con uno provisional). No toca el identificador: historico, empresas y metas
-- siguen donde estaban. El trigger on_auth_user_confirmed sincroniza
-- profiles.email solo.
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

-- ------------------------------------------------------------
-- Contrasena temporal nueva. Para cuentas con correo provisional, que no
-- pueden recuperarla por email porque ese buzon no existe.
-- ------------------------------------------------------------
create or replace function admin_set_password(target_user uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not is_super_admin() then
    raise exception 'Solo el super admin puede restablecer contrasenas';
  end if;
  if length(coalesce(p_password, '')) < 8 then
    raise exception 'La contrasena debe tener al menos 8 caracteres';
  end if;

  update auth.users
     set encrypted_password = crypt(p_password, gen_salt('bf')),
         updated_at = now()
   where id = target_user;

  if not found then
    raise exception 'La cuenta no existe';
  end if;
end;
$$;

-- ------------------------------------------------------------
-- Bloquear o desbloquear el inicio de sesion. Complementa a RLS: el estado del
-- perfil ya niega los datos; esto impide ademas canjear el refresh token.
-- ------------------------------------------------------------
create or replace function admin_ban_user(target_user uuid, bloquear boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_super_admin() then
    raise exception 'Solo el super admin puede bloquear cuentas';
  end if;
  if target_user = (select auth.uid()) then
    raise exception 'No puedes bloquearte a ti mismo';
  end if;

  update auth.users
     set banned_until = case when bloquear then now() + interval '100 years' end,
         updated_at = now()
   where id = target_user;

  if not found then
    raise exception 'La cuenta no existe';
  end if;
end;
$$;

revoke all on function admin_create_user(text, text, user_role, text, text, boolean) from public, anon;
revoke all on function admin_change_email(uuid, text) from public, anon;
revoke all on function admin_set_password(uuid, text) from public, anon;
revoke all on function admin_ban_user(uuid, boolean) from public, anon;
grant execute on function admin_create_user(text, text, user_role, text, text, boolean) to authenticated;
grant execute on function admin_change_email(uuid, text) to authenticated;
grant execute on function admin_set_password(uuid, text) to authenticated;
grant execute on function admin_ban_user(uuid, boolean) to authenticated;
