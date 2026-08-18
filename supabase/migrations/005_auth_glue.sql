-- ============================================================
-- Enganche entre auth.users y profiles
--
-- No hay registro publico: el super admin invita. Al crearse el usuario en Auth
-- (invitacion o alta manual desde el panel) nace aqui su perfil, tomando el
-- nombre y el rol de la metadata de la invitacion.
--
-- El primer usuario de la instalacion nace super_admin y activo: si no, no
-- habria nadie con permiso para crear al resto (problema del huevo y la
-- gallina). A partir del segundo, todos nacen invitados con el rol que se les
-- haya asignado.
-- ============================================================
create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  es_el_primero boolean;
  nombre        text;
  rol           user_role;
begin
  select not exists (select 1 from profiles) into es_el_primero;

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
      -- Si el alta trae contrasena confirmada, ya puede entrar.
      when new.email_confirmed_at is not null then 'activo'::user_status
      else 'invitado'::user_status
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- ------------------------------------------------------------
-- El invitado pasa a activo cuando acepta la invitacion y define su
-- contrasena (ahi Auth marca email_confirmed_at).
-- ------------------------------------------------------------
create or replace function handle_auth_user_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update profiles
       set status = 'activo'
     where id = new.id and status = 'invitado';
  end if;

  -- El correo se mantiene sincronizado si se cambia desde Auth.
  if new.email is distinct from old.email then
    update profiles set email = new.email where id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after update on auth.users
  for each row execute function handle_auth_user_confirmed();

-- ------------------------------------------------------------
-- Datos de sesion en una sola llamada: quien soy, con que rol, y a que
-- empresas y sedes tengo acceso. Evita cinco consultas al pintar el shell.
-- ------------------------------------------------------------
create or replace function me()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'profile', to_jsonb(p) - 'deleted_by',
    'companies', coalesce((
      select jsonb_agg(jsonb_build_object(
               'company_id', cu.company_id,
               'branch_id',  cu.branch_id,
               'role',       cu.role
             ) order by cu.assigned_at)
      from company_users cu
      where cu.user_id = p.id and cu.removed_at is null
    ), '[]'::jsonb)
  )
  from profiles p
  where p.id = (select auth.uid());
$$;

revoke all on function me() from public;
grant execute on function me() to authenticated;
