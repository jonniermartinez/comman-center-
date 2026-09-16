-- ============================================================
-- Command Center · 046 · Cada empresa conecta su propio Kommo
--
-- Las agendas ya no se digitan: cada oficina las lleva en su cuenta de Kommo.
-- Hay una cuenta por empresa, así que la credencial no puede vivir en el .env
-- —sería una sola para toda la instalación— sino en la base, por empresa.
--
-- Cómo se protege el token:
--
-- 1. Se guarda cifrado en Vault (`vault.secrets`), no en una columna de
--    `kommo_integrations`. La tabla solo guarda el id del secreto y los últimos
--    cuatro caracteres para reconocerlo en pantalla.
-- 2. Ninguna función lo devuelve. La aplicación no lo lee nunca: las llamadas
--    a Kommo las hace Postgres con la extensión `http`, dentro de
--    `kommo_get`, que descifra el token, llama y devuelve solo la respuesta.
--    Así el token no viaja a Cloudflare ni al navegador, y un coordinador con
--    las herramientas del navegador abiertas no tiene cómo verlo.
-- 3. `kommo_get` solo hace GET, solo a `https://<subdominio>.kommo.com` y solo
--    a las rutas de lectura que usa la sincronización. No es un proxy genérico.
-- 4. La tabla no tiene políticas de escritura: cambiar `token_secret_id` a mano
--    permitiría apuntar al secreto de otra empresa. Todo se escribe por
--    funciones `security definer` con su guarda.
--
-- Conectar o cambiar la credencial es del super admin. Ajustar el mapeo y
-- sincronizar lo puede hacer también el coordinador de la empresa.
-- ============================================================

create extension if not exists http with schema extensions;

-- Intento de quitarle a los roles de la aplicación la ejecución de `http()`.
-- En Supabase no tiene efecto: el permiso a PUBLIC lo concede
-- `supabase_admin` y `postgres` no puede revocar lo que otro concedió
-- (verificado tras aplicar). Lo que sí protege es que `extensions` no está
-- expuesto por PostgREST: desde la API la única salida HTTP es `kommo_get`.
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure
      from pg_proc p
      join pg_depend d on d.objid = p.oid and d.deptype = 'e'
      join pg_extension e on e.oid = d.refobjid
     where e.extname = 'http'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- La integración de cada empresa
-- ------------------------------------------------------------
create table if not exists kommo_integrations (
  company_id      uuid primary key references companies (id) on delete cascade,
  subdomain       text not null check (subdomain ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
  token_secret_id uuid not null,
  token_hint      text not null,
  -- Cómo se lee una agenda en esta cuenta. Lo arma la pantalla de integración:
  --   modo            'lead_fecha' | 'tarea' | 'etapa'
  --   pipeline_id     embudo de donde salen los leads
  --   etapa_id        etapa que significa "agendado"          (modo etapa)
  --   campo_fecha_id  campo de fecha del lead que es la cita   (modo lead_fecha)
  --   tipo_tarea_id   tipo de tarea que es la cita             (modo tarea)
  --   resultados      { "<status_id>": "Venta" | "Seguimiento 1" | … }
  --   usuarios        { "<kommo_user_id>": "<staff_id>" }
  --   branch_id       sede por defecto si el responsable no tiene una
  config          jsonb not null default '{}'::jsonb,
  last_sync_at    timestamptz,
  last_sync_count int,
  last_error      text,
  created_by      uuid references profiles (id),
  created_at      timestamptz not null default now(),
  updated_by      uuid references profiles (id),
  updated_at      timestamptz not null default now()
);

comment on table kommo_integrations is
  'Conexión de cada empresa con su cuenta de Kommo. El token está en Vault; esta tabla solo guarda su id. Se escribe únicamente por las funciones kommo_*.';

alter table kommo_integrations enable row level security;

create policy kommo_integrations_select on kommo_integrations
  for select using (can_manage_company(company_id));

create trigger kommo_integrations_set_updated_at
  before update on kommo_integrations
  for each row execute function set_updated_at();

-- Borrar la integración (o la empresa, en cascada) no debe dejar el token
-- huérfano en Vault.
create or replace function kommo_borrar_secreto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from vault.secrets where id = old.token_secret_id;
  return old;
end;
$$;

revoke execute on function kommo_borrar_secreto() from public, anon, authenticated;

create trigger kommo_integrations_borrar_secreto
  after delete on kommo_integrations
  for each row execute function kommo_borrar_secreto();

-- ------------------------------------------------------------
-- Las agendas que vienen de Kommo
-- ------------------------------------------------------------
alter table appointments drop constraint if exists appointments_source_check;
alter table appointments
  add constraint appointments_source_check check (source in ('app', 'excel', 'kommo'));

alter table appointments add column if not exists external_id text;

comment on column appointments.external_id is
  'Identificador en el sistema de origen. Para Kommo: "lead:<id>", "tarea:<id>" o "evento:<id>". Es lo que hace que sincronizar dos veces actualice en vez de duplicar.';

create unique index if not exists appointments_externo_idx
  on appointments (company_id, external_id) where source = 'kommo';

-- ------------------------------------------------------------
-- Conectar, configurar y desconectar
-- ------------------------------------------------------------
create or replace function kommo_conectar(p_company uuid, p_subdomain text, p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sub    text := lower(trim(p_subdomain));
  token  text := trim(p_token);
  actual kommo_integrations;
begin
  if not is_super_admin() then
    raise exception 'Solo el super admin conecta una cuenta de Kommo';
  end if;
  if sub !~ '^[a-z0-9][a-z0-9-]{0,62}$' then
    raise exception 'El subdominio de Kommo no es válido';
  end if;
  if length(token) < 20 then
    raise exception 'El token de Kommo no es válido';
  end if;

  select * into actual from kommo_integrations where company_id = p_company;

  if found then
    perform vault.update_secret(actual.token_secret_id, token);
    update kommo_integrations
       set subdomain  = sub,
           token_hint = right(token, 4),
           last_error = null,
           updated_by = auth.uid()
     where company_id = p_company;
  else
    insert into kommo_integrations
      (company_id, subdomain, token_secret_id, token_hint, created_by, updated_by)
    values (
      p_company,
      sub,
      vault.create_secret(token, 'kommo_token_' || p_company, 'Token de Kommo de la empresa ' || p_company),
      right(token, 4),
      auth.uid(),
      auth.uid()
    );
  end if;
end;
$$;

create or replace function kommo_desconectar(p_company uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_super_admin() then
    raise exception 'Solo el super admin desconecta una cuenta de Kommo';
  end if;
  -- El trigger se lleva el secreto de Vault. Las agendas ya sincronizadas se
  -- quedan: son histórico de la empresa.
  delete from kommo_integrations where company_id = p_company;
end;
$$;

create or replace function kommo_configurar(p_company uuid, p_config jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not can_manage_company(p_company) then
    raise exception 'No tienes permiso para configurar la integración de esta empresa';
  end if;
  if jsonb_typeof(p_config) is distinct from 'object' then
    raise exception 'La configuración debe ser un objeto';
  end if;
  if coalesce(p_config ->> 'modo', '') not in ('lead_fecha', 'tarea', 'etapa') then
    raise exception 'El modo debe ser lead_fecha, tarea o etapa';
  end if;

  update kommo_integrations
     set config = p_config, updated_by = auth.uid()
   where company_id = p_company;
  if not found then
    raise exception 'Esta empresa no tiene una cuenta de Kommo conectada';
  end if;
end;
$$;

create or replace function kommo_registrar_sync(p_company uuid, p_count int, p_error text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not can_manage_company(p_company) then
    raise exception 'No tienes permiso para sincronizar esta empresa';
  end if;
  update kommo_integrations
     set last_sync_at    = case when p_error is null then now() else last_sync_at end,
         last_sync_count = case when p_error is null then p_count else last_sync_count end,
         last_error      = p_error
   where company_id = p_company;
end;
$$;

-- ------------------------------------------------------------
-- Leer de Kommo sin que el token salga de la base
-- ------------------------------------------------------------
create or replace function kommo_get(p_company uuid, p_path text, p_query text default '')
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  integ     kommo_integrations;
  token     text;
  query     text := coalesce(p_query, '');
  respuesta extensions.http_response;
begin
  if not can_manage_company(p_company) then
    raise exception 'No tienes permiso para leer el Kommo de esta empresa';
  end if;

  -- Solo lectura, y solo lo que usa la sincronización.
  if p_path !~ '^/api/v4/(account|users|leads|leads/pipelines|leads/custom_fields|contacts|tasks|events)$' then
    raise exception 'Ruta de Kommo no permitida: %', p_path;
  end if;
  if query !~ '^[A-Za-z0-9_\[\]=&%.,:-]*$' then
    raise exception 'Parámetros de Kommo no permitidos';
  end if;

  select * into integ from kommo_integrations where company_id = p_company;
  if not found then
    raise exception 'Esta empresa no tiene una cuenta de Kommo conectada';
  end if;

  select decrypted_secret into token from vault.decrypted_secrets where id = integ.token_secret_id;

  -- Por debajo del statement_timeout de `authenticated` (8 s): mejor un error
  -- de Kommo que se puede explicar que una cancelación de la consulta.
  perform http_set_curlopt('CURLOPT_TIMEOUT', '7');

  respuesta := http((
    'GET',
    'https://' || integ.subdomain || '.kommo.com' || p_path
      || case when query = '' then '' else '?' || query end,
    array[http_header('Authorization', 'Bearer ' || token)],
    null,
    null
  )::http_request);

  return jsonb_build_object(
    'status', respuesta.status,
    -- 204 es "no hay resultados": Kommo no manda cuerpo.
    'body', case
      when respuesta.status = 204 or coalesce(respuesta.content, '') = '' then null
      when respuesta.content_type ilike '%json%' then respuesta.content::jsonb
      else to_jsonb(left(respuesta.content, 500))
    end
  );
end;
$$;

-- ------------------------------------------------------------
-- Guardar lo que llegó
--
-- Security invoker a propósito: escribe en `appointments` con los permisos de
-- quien sincroniza, así que RLS sigue decidiendo. El upsert va acá y no por
-- PostgREST porque la llave es un índice parcial (solo filas de Kommo), y el
-- `on conflict` de la API no sabe expresar el `where`.
-- ------------------------------------------------------------
create or replace function kommo_guardar_agendas(p_company uuid, p_filas jsonb)
returns int
language plpgsql
set search_path = public
as $$
declare
  n int;
begin
  if not can_manage_company(p_company) then
    raise exception 'No tienes permiso para sincronizar esta empresa';
  end if;

  insert into appointments as a (
    company_id, branch_id, nombre, celular, scheduled_at, scheduled_time,
    staff_id, responsable_nombre, resultado, observacion,
    source, external_id, created_by, updated_by
  )
  select p_company,
         (f ->> 'branch_id')::uuid,
         f ->> 'nombre',
         f ->> 'celular',
         (f ->> 'scheduled_at')::date,
         nullif(f ->> 'scheduled_time', '')::time,
         nullif(f ->> 'staff_id', '')::uuid,
         f ->> 'responsable_nombre',
         f ->> 'resultado',
         f ->> 'observacion',
         'kommo',
         f ->> 'external_id',
         auth.uid(),
         auth.uid()
    from jsonb_array_elements(p_filas) f
  on conflict (company_id, external_id) where source = 'kommo'
  do update set
    branch_id          = excluded.branch_id,
    nombre             = excluded.nombre,
    celular            = excluded.celular,
    scheduled_at       = excluded.scheduled_at,
    scheduled_time     = excluded.scheduled_time,
    staff_id           = excluded.staff_id,
    responsable_nombre = excluded.responsable_nombre,
    resultado          = excluded.resultado,
    observacion        = excluded.observacion,
    updated_by         = excluded.updated_by;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function
  kommo_conectar(uuid, text, text),
  kommo_desconectar(uuid),
  kommo_configurar(uuid, jsonb),
  kommo_registrar_sync(uuid, int, text),
  kommo_get(uuid, text, text),
  kommo_guardar_agendas(uuid, jsonb)
from public, anon;

grant execute on function
  kommo_conectar(uuid, text, text),
  kommo_desconectar(uuid),
  kommo_configurar(uuid, jsonb),
  kommo_registrar_sync(uuid, int, text),
  kommo_get(uuid, text, text),
  kommo_guardar_agendas(uuid, jsonb)
to authenticated;
