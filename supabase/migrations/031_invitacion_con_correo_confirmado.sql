-- ============================================================
-- La invitacion no llegaba: Auth trataba al invitado como desconocido.
--
-- admin_create_user dejaba la cuenta con email_confirmed_at en null, y para
-- GoTrue una cuenta sin confirmar es "alguien que no termino de registrarse".
-- Al pedirle el enlace magico (signInWithOtp con shouldCreateUser=false)
-- respondia "Signups not allowed for this instance": ni enlace ni correo.
--
-- Ahora la cuenta invitada nace con el correo confirmado y una contrasena
-- aleatoria que nadie conoce: no puede entrar hasta canjear el enlace, pero
-- para Auth ya existe y el enlace magico sale. Lo que decia "invitado" era el
-- correo sin confirmar; ahora lo dice una marca en la metadata, y el perfil
-- pasa a activo en el primer inicio de sesion (last_sign_in_at), que es
-- justo cuando canjea el enlace y define su clave.
-- ============================================================

-- ------------------------------------------------------------
-- Perfil al nacer: invitado si la cuenta viene marcada como tal, aunque el
-- correo figure confirmado.
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
  invitado   := coalesce(new.raw_user_meta_data ->> 'invitado', '') = 'true';

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
      when invitado then 'invitado'::user_status
      when new.email_confirmed_at is not null then 'activo'::user_status
      else 'invitado'::user_status
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- El invitado pasa a activo al entrar por primera vez (canjeo del enlace) o,
-- como antes, cuando Auth confirma el correo.
-- ------------------------------------------------------------
create or replace function handle_auth_user_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.email_confirmed_at is not null and old.email_confirmed_at is null)
     or (new.last_sign_in_at is not null and old.last_sign_in_at is null) then
    update profiles
       set status = 'activo'
     where id = new.id and status = 'invitado';
  end if;

  if new.email is distinct from old.email then
    update profiles set email = new.email where id = new.id;
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- admin_create_user con p_invitado: correo confirmado + marca de invitado.
-- Se reemplaza la firma entera para no dejar dos sobrecargas.
-- ------------------------------------------------------------
drop function if exists admin_create_user(text, text, user_role, text, text, boolean);

create or replace function admin_create_user(
  p_email      text,
  p_full_name  text,
  p_role       user_role default 'asesor',
  p_password   text      default null,
  p_phone      text      default null,
  p_confirmado boolean   default false,
  p_invitado   boolean   default false
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid        uuid := gen_random_uuid();
  correo     text := lower(trim(p_email));
  confirmado boolean := p_confirmado or p_invitado;
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
    case when confirmado then now() end,
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_strip_nulls(jsonb_build_object(
      'full_name', trim(p_full_name),
      'role',      p_role::text,
      'phone',     nullif(trim(coalesce(p_phone, '')), ''),
      'invitado',  case when p_invitado then true end
    )),
    now(), now(),
    '', '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, provider, identity_data,
    last_sign_in_at, created_at, updated_at
  )
  values (
    gen_random_uuid(), uid, uid::text, 'email',
    jsonb_build_object('sub', uid::text, 'email', correo, 'email_verified', confirmado),
    now(), now(), now()
  );

  return uid;
end;
$$;

revoke all on function admin_create_user(text, text, user_role, text, text, boolean, boolean) from public, anon;
grant execute on function admin_create_user(text, text, user_role, text, text, boolean, boolean) to authenticated;

-- ------------------------------------------------------------
-- Las cuentas invitadas que ya existian quedaron sin confirmar y por eso no
-- podian recibir el enlace. Se ponen en el estado nuevo para que "Reenviar
-- invitacion" funcione con ellas.
-- ------------------------------------------------------------
update auth.users u
   set email_confirmed_at = now(),
       raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb) || '{"invitado": true}'::jsonb,
       updated_at = now()
  from profiles p
 where p.id = u.id
   and p.status = 'invitado'
   and u.email_confirmed_at is null;

update auth.identities i
   set identity_data = i.identity_data || '{"email_verified": true}'::jsonb
  from profiles p
 where p.id = i.user_id
   and i.provider = 'email'
   and p.status = 'invitado';
