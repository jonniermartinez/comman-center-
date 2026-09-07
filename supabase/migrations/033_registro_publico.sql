-- Registro público con código al correo.
--
-- Hasta aquí las cuentas solo las creaba el super admin y la invitación
-- viajaba por un enlace mágico que se rompía con facilidad (el cliente de
-- correo lo abría antes que la persona y el token de un solo uso moría).
-- Ahora cualquiera se crea la cuenta con correo y contraseña, la confirma con
-- el código de seis dígitos que le llega, y entra como asesor sin ninguna
-- empresa asignada: ve la aplicación vacía hasta que el super admin lo asigne.
--
-- Lo que sigue estando cerrado es el rol. Una alta pública puede traer lo que
-- quiera en la metadata (signUp la acepta desde el navegador), así que el rol
-- que ahí venga solo se respeta cuando la alta viene de admin_create_user,
-- que es quien pone la marca app.alta_autorizada. Sin la marca: asesor.
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
      -- Alta pública: queda pendiente hasta que confirme el código. Lo pasa a
      -- activo handle_auth_user_confirmed cuando Auth marca el correo.
      when new.email_confirmed_at is not null then 'activo'::user_status
      else 'invitado'::user_status
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
