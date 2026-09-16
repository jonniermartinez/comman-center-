-- ============================================================
-- Command Center · 047 · Las agendas se escriben en Kommo y llegan por webhook
--
-- Desde ahora una agenda no se crea ni se corrige en la aplicación: nace en
-- Kommo y acá se lee. El problema de solo leer la API es el pasado: Kommo
-- responde cómo está un lead hoy, no cómo estaba el martes. Si un lead pasó
-- por "Agendado" y hoy está en "Venta", preguntarle a la API no dice que el
-- martes hubo una agenda.
--
-- Por eso cada cambio se guarda cuando ocurre:
--
-- 1. Kommo avisa por webhook a `/api/kommo/webhook/<secreto>`. La ruta no
--    tiene sesión, así que llama a `kommo_webhook_recibir` con la clave
--    publicable. El secreto de la URL es lo que identifica a la empresa; en
--    la base solo se guarda su hash.
-- 2. El aviso crudo queda en `kommo_eventos`, tal cual llegó: es la prueba de
--    lo que pasó, aunque después se cambie el mapeo o se borre el lead.
-- 3. Con la configuración de la empresa (046) se convierte en agenda.
--    La agenda queda fija con su fecha: moverla en Kommo después no reescribe
--    la historia, crea la nueva.
-- 4. El aviso no trae el teléfono del cliente. Un trabajo de pg_cron completa
--    nombre y celular pidiéndole a Kommo el contacto del lead, desde la base,
--    sin pasar por la aplicación.
--
-- Lo anterior a conectar el webhook se trae una vez con "Traer histórico"
-- (Events API de Kommo), con las mismas llaves, así que no se duplica.
--
-- Las agendas del Excel se quedan: tienen `source = 'excel'` y la pantalla lo
-- dice. Lo que ya no existe es escribir agendas desde la aplicación.
-- ============================================================

-- ------------------------------------------------------------
-- De dónde viene cada agenda en Kommo
-- ------------------------------------------------------------
alter table appointments add column if not exists external_lead_id bigint;
alter table appointments add column if not exists external_url text;
alter table appointments add column if not exists kommo_completado boolean not null default false;

comment on column appointments.external_lead_id is 'Id del lead en Kommo.';
comment on column appointments.external_url is 'Enlace al lead en Kommo, guardado al recibirlo para que lo abra también quien no ve la integración.';
comment on column appointments.kommo_completado is 'Ya se consultó en Kommo el contacto del lead (nombre y celular).';

create index if not exists appointments_kommo_lead_idx
  on appointments (company_id, external_lead_id) where source = 'kommo';
create index if not exists appointments_kommo_pendiente_idx
  on appointments (company_id) where source = 'kommo' and not kommo_completado;

-- ------------------------------------------------------------
-- Webhook: secreto por empresa y registro crudo
-- ------------------------------------------------------------
alter table kommo_integrations add column if not exists webhook_hash text unique;
alter table kommo_integrations add column if not exists webhook_ultimo_at timestamptz;

create table if not exists kommo_eventos (
  id          bigint generated always as identity primary key,
  company_id  uuid not null references companies (id) on delete cascade,
  recibido_at timestamptz not null default now(),
  entidad     text not null,
  accion      text not null,
  entity_id   bigint,
  payload     jsonb not null,
  error       text
);

comment on table kommo_eventos is
  'Cada aviso de Kommo tal como llegó por webhook. Es el respaldo de las agendas: si el mapeo cambia, se puede reconstruir desde acá.';

create index if not exists kommo_eventos_company_idx on kommo_eventos (company_id, recibido_at desc);

alter table kommo_eventos enable row level security;
create policy kommo_eventos_select on kommo_eventos
  for select using (can_manage_company(company_id));

create or replace function kommo_generar_webhook(p_company uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  secreto text := encode(gen_random_bytes(24), 'hex');
begin
  if not is_super_admin() then
    raise exception 'Solo el super admin genera la dirección del webhook';
  end if;
  update kommo_integrations
     set webhook_hash = encode(digest(secreto, 'sha256'), 'hex'), updated_by = auth.uid()
   where company_id = p_company;
  if not found then
    raise exception 'Esta empresa no tiene una cuenta de Kommo conectada';
  end if;
  -- Se devuelve una sola vez. Generar otro invalida la dirección anterior.
  return secreto;
end;
$$;

revoke execute on function kommo_generar_webhook(uuid) from public, anon;
grant execute on function kommo_generar_webhook(uuid) to authenticated;

-- ------------------------------------------------------------
-- Llamar a Kommo desde la base
--
-- `kommo_get` (046) queda como la puerta con guarda para la aplicación; la
-- llamada en sí pasa a `kommo_http`, que no tiene guarda y por eso no la puede
-- ejecutar ningún rol de la API. La usan `kommo_get` y el trabajo de pg_cron.
-- ------------------------------------------------------------
create or replace function kommo_http(p_company uuid, p_path text, p_query text default '')
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

  -- Por debajo del statement_timeout de `authenticated` (8 s).
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
    'body', case
      when respuesta.status = 204 or coalesce(respuesta.content, '') = '' then null
      when respuesta.content_type ilike '%json%' then respuesta.content::jsonb
      else to_jsonb(left(respuesta.content, 500))
    end
  );
end;
$$;

revoke execute on function kommo_http(uuid, text, text) from public, anon, authenticated;

create or replace function kommo_get(p_company uuid, p_path text, p_query text default '')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not can_manage_company(p_company) then
    raise exception 'No tienes permiso para leer el Kommo de esta empresa';
  end if;
  return kommo_http(p_company, p_path, p_query);
end;
$$;

-- ------------------------------------------------------------
-- Una cita → una agenda
--
-- Todos los caminos (webhook, histórico) terminan acá, así que la regla de
-- responsable, sede y resultado es una sola.
-- ------------------------------------------------------------
create or replace function kommo_guardar_cita(
  p_company     uuid,
  p_config      jsonb,
  p_subdomain   text,
  p_external_id text,
  p_lead_id     bigint,
  p_momento     timestamptz,
  p_solo_fecha  boolean,
  p_responsable bigint,
  p_nombre      text,
  p_status_id   bigint,
  p_nota        text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff  uuid;
  v_branch uuid;
  v_nombre text;
  v_fecha  date;
  v_hora   time;
begin
  if p_solo_fecha then
    -- Un campo "fecha" es medianoche UTC o medianoche local: el día UTC sirve para los dos.
    v_fecha := (p_momento at time zone 'UTC')::date;
    v_hora  := null;
  else
    v_fecha := (p_momento at time zone 'America/Bogota')::date;
    v_hora  := (p_momento at time zone 'America/Bogota')::time;
  end if;

  select cs.staff_id, cs.branch_id, s.full_name
    into v_staff, v_branch, v_nombre
    from company_staff cs
    join staff s on s.id = cs.staff_id
   where cs.company_id = p_company
     and cs.staff_id::text = p_config -> 'usuarios' ->> p_responsable::text;

  if v_branch is null then
    select id into v_branch
      from branches
     where company_id = p_company
       and status = 'activa'
     order by (id::text = coalesce(p_config ->> 'branch_id', '')) desc, is_primary desc
     limit 1;
  end if;
  if v_branch is null then
    raise exception 'La empresa no tiene sedes activas';
  end if;

  insert into appointments as a (
    company_id, branch_id, nombre, scheduled_at, scheduled_time,
    staff_id, responsable_nombre, resultado, observacion,
    source, external_id, external_lead_id, external_url
  )
  values (
    p_company, v_branch, nullif(trim(p_nombre), ''), v_fecha, v_hora,
    v_staff, v_nombre, p_config -> 'resultados' ->> p_status_id::text, nullif(trim(p_nota), ''),
    'kommo', p_external_id, p_lead_id,
    'https://' || p_subdomain || '.kommo.com/leads/detail/' || p_lead_id
  )
  on conflict (company_id, external_id) where source = 'kommo'
  do update set
    scheduled_at       = excluded.scheduled_at,
    scheduled_time     = excluded.scheduled_time,
    staff_id           = excluded.staff_id,
    responsable_nombre = excluded.responsable_nombre,
    branch_id          = excluded.branch_id,
    -- Si ya se completó con el contacto, el nombre del lead no lo pisa.
    nombre             = case when a.kommo_completado then a.nombre else coalesce(excluded.nombre, a.nombre) end,
    resultado          = coalesce(excluded.resultado, a.resultado),
    observacion        = coalesce(excluded.observacion, a.observacion);
end;
$$;

revoke execute on function
  kommo_guardar_cita(uuid, jsonb, text, text, bigint, timestamptz, boolean, bigint, text, bigint, text)
from public, anon, authenticated;

-- Un número que Kommo manda como texto, o null.
create or replace function kommo_num(p text)
returns bigint
language sql
immutable
as $$
  select case when p ~ '^\d{1,18}$' then p::bigint end
$$;

-- ------------------------------------------------------------
-- Aplicar un aviso
-- ------------------------------------------------------------
create or replace function kommo_aplicar(p_company uuid, p_entidad text, p_accion text, p_item jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  integ    kommo_integrations;
  cfg      jsonb;
  modo     text;
  lead_id  bigint;
  status   bigint;
  pipeline bigint;
  campo    jsonb;
  valor    text;
  momento  timestamptz;
  fecha    date;
begin
  select * into integ from kommo_integrations where company_id = p_company;
  cfg  := integ.config;
  modo := cfg ->> 'modo';
  if modo is null then
    return;
  end if;

  if p_entidad = 'leads' and p_accion in ('add', 'update', 'status', 'responsible', 'restore') then
    lead_id  := kommo_num(p_item ->> 'id');
    status   := kommo_num(p_item ->> 'status_id');
    pipeline := kommo_num(p_item ->> 'pipeline_id');
    if lead_id is null then
      return;
    end if;

    -- El resultado de la última agenda del lead sigue a su etapa actual.
    if status is not null and cfg -> 'resultados' ? status::text then
      update appointments
         set resultado = cfg -> 'resultados' ->> status::text
       where id = (
         select id from appointments
          where company_id = p_company and source = 'kommo' and external_lead_id = lead_id
          order by scheduled_at desc, scheduled_time desc nulls last
          limit 1
       );
    end if;

    if cfg ->> 'pipeline_id' is not null and pipeline is distinct from (cfg ->> 'pipeline_id')::bigint then
      return;
    end if;

    -- Modo etapa: entrar a la etapa "agendado" es la agenda, ese día.
    if modo = 'etapa' and p_accion in ('add', 'status')
       and status = (cfg ->> 'etapa_id')::bigint then
      momento := to_timestamp(coalesce(kommo_num(p_item ->> 'last_modified'),
                                       kommo_num(p_item ->> 'updated_at'),
                                       extract(epoch from now())::bigint));
      perform kommo_guardar_cita(
        p_company, cfg, integ.subdomain,
        'etapa:' || lead_id || ':' || (momento at time zone 'America/Bogota')::date,
        lead_id, momento, false,
        kommo_num(p_item ->> 'responsible_user_id'), p_item ->> 'name', status, null
      );
    end if;

    -- Modo campo de fecha: la fecha del campo es la agenda.
    if modo = 'lead_fecha' then
      select c.value into campo
        from jsonb_array_elements(coalesce(p_item -> 'custom_fields', '[]'::jsonb)) c
       where c.value ->> 'id' = cfg ->> 'campo_fecha_id'
       limit 1;
      -- El valor llega como {"value": "…"} o suelto, según el tipo de campo.
      valor := coalesce(campo -> 'values' -> 0 ->> 'value', campo -> 'values' ->> 0);
      if kommo_num(valor) is null then
        return;
      end if;
      momento := to_timestamp(kommo_num(valor));
      fecha := case when cfg ->> 'campo_fecha_tipo' = 'date'
                    then (momento at time zone 'UTC')::date
                    else (momento at time zone 'America/Bogota')::date end;

      perform kommo_guardar_cita(
        p_company, cfg, integ.subdomain,
        'lead:' || lead_id || ':' || fecha,
        lead_id, momento, cfg ->> 'campo_fecha_tipo' = 'date',
        kommo_num(p_item ->> 'responsible_user_id'), p_item ->> 'name', status, null
      );

      -- La agenda vieja no se borra: queda dicho que se movió.
      update appointments
         set observacion = 'Reprogramada al ' || to_char(fecha, 'DD/MM/YYYY')
       where company_id = p_company and source = 'kommo' and external_lead_id = lead_id
         and external_id like 'lead:%' and scheduled_at <> fecha and scheduled_at >= current_date;
    end if;
  end if;

  -- Modo tarea: la tarea del tipo elegido, ligada a un lead (element_type 2).
  if p_entidad = 'task' and p_accion in ('add', 'update') and modo = 'tarea'
     and p_item ->> 'element_type' = '2'
     and p_item ->> 'task_type' = cfg ->> 'tipo_tarea_id'
     and kommo_num(p_item ->> 'complete_before') is not null then
    perform kommo_guardar_cita(
      p_company, cfg, integ.subdomain,
      'tarea:' || (p_item ->> 'id'),
      kommo_num(p_item ->> 'element_id'),
      to_timestamp(kommo_num(p_item ->> 'complete_before')), false,
      kommo_num(p_item ->> 'responsible_user_id'), null, null, p_item ->> 'text'
    );
  end if;
end;
$$;

revoke execute on function kommo_aplicar(uuid, text, text, jsonb) from public, anon, authenticated;

-- ------------------------------------------------------------
-- La puerta del webhook
--
-- La única función de este proyecto que puede llamar `anon`: Kommo no tiene
-- sesión. Lo que la protege es el secreto de la URL (48 caracteres
-- aleatorios); sin él no se sabe ni a qué empresa se le escribe.
-- ------------------------------------------------------------
create or replace function kommo_webhook_recibir(p_secreto text, p_payload jsonb)
returns int
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  empresa  uuid;
  entidad  text;
  acciones jsonb;
  accion   text;
  items    jsonb;
  item     jsonb;
  n        int := 0;
  fallo    text;
begin
  if length(coalesce(p_secreto, '')) < 32 then
    raise exception 'Webhook desconocido';
  end if;

  select company_id into empresa
    from kommo_integrations
   where webhook_hash = encode(digest(p_secreto, 'sha256'), 'hex');
  if empresa is null then
    raise exception 'Webhook desconocido';
  end if;

  update kommo_integrations set webhook_ultimo_at = now() where company_id = empresa;

  for entidad, acciones in select key, value from jsonb_each(p_payload) loop
    if entidad not in ('leads', 'task') or jsonb_typeof(acciones) <> 'object' then
      continue;
    end if;
    for accion, items in select key, value from jsonb_each(acciones) loop
      if jsonb_typeof(items) <> 'array' then
        continue;
      end if;
      for item in select value from jsonb_array_elements(items) loop
        fallo := null;
        begin
          perform kommo_aplicar(empresa, entidad, accion, item);
        exception when others then
          -- Un aviso que no se pudo aplicar no tumba a los demás, y queda
          -- guardado con su error para reprocesarlo.
          fallo := sqlerrm;
        end;
        insert into kommo_eventos (company_id, entidad, accion, entity_id, payload, error)
        values (empresa, entidad, accion, kommo_num(item ->> 'id'), item, fallo);
        n := n + 1;
      end loop;
    end loop;
  end loop;

  return n;
end;
$$;

revoke execute on function kommo_webhook_recibir(text, jsonb) from public;
grant execute on function kommo_webhook_recibir(text, jsonb) to anon, authenticated;

-- ------------------------------------------------------------
-- Histórico: lo que devuelve la Events API, por la misma regla
--
-- Reemplaza a la versión de 046, que recibía filas ya armadas en la
-- aplicación. Ahora recibe citas y la base decide responsable, sede y
-- resultado igual que para el webhook.
-- ------------------------------------------------------------
drop function if exists kommo_guardar_agendas(uuid, jsonb);

create or replace function kommo_guardar_citas(p_company uuid, p_citas jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  integ kommo_integrations;
  c     jsonb;
  n     int := 0;
begin
  if not can_manage_company(p_company) then
    raise exception 'No tienes permiso para sincronizar esta empresa';
  end if;
  select * into integ from kommo_integrations where company_id = p_company;
  if not found then
    raise exception 'Esta empresa no tiene una cuenta de Kommo conectada';
  end if;

  for c in select value from jsonb_array_elements(p_citas) loop
    perform kommo_guardar_cita(
      p_company, integ.config, integ.subdomain,
      c ->> 'external_id',
      (c ->> 'lead_id')::bigint,
      to_timestamp((c ->> 'momento')::bigint),
      coalesce((c ->> 'solo_fecha')::boolean, false),
      (c ->> 'responsable')::bigint,
      c ->> 'nombre',
      (c ->> 'status_id')::bigint,
      c ->> 'nota'
    );
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke execute on function kommo_guardar_citas(uuid, jsonb) from public, anon;
grant execute on function kommo_guardar_citas(uuid, jsonb) to authenticated;

-- ------------------------------------------------------------
-- Completar nombre y celular
--
-- El aviso de Kommo trae el lead, no su contacto. Cada dos minutos se toman
-- hasta 50 agendas sin completar por empresa, se le pide a Kommo el contacto
-- principal de cada lead y se guarda. Corre como `postgres` desde pg_cron, así
-- que no depende de que alguien tenga la aplicación abierta.
-- ------------------------------------------------------------
create or replace function kommo_completar_contactos()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  integ     kommo_integrations;
  ids       bigint[];
  resp      jsonb;
  lead      jsonb;
  contacto  jsonb;
  contactos jsonb := '{}'::jsonb;
  por_lead  jsonb := '{}'::jsonb;
  cid       text;
  telefono  text;
  total     int := 0;
begin
  for integ in select * from kommo_integrations loop
    begin
      select array_agg(distinct external_lead_id) into ids
        from (
          select external_lead_id from appointments
           where company_id = integ.company_id and source = 'kommo'
             and not kommo_completado and external_lead_id is not null
           limit 50
        ) p;
      if ids is null then
        continue;
      end if;

      resp := kommo_http(integ.company_id, '/api/v4/leads',
        (select string_agg('filter[id][]=' || i, '&') from unnest(ids) i) || '&with=contacts&limit=250');
      if (resp ->> 'status')::int not in (200, 204) then
        raise exception 'Kommo respondió % al leer leads', resp ->> 'status';
      end if;

      por_lead := '{}'::jsonb;
      for lead in select value from jsonb_array_elements(coalesce(resp -> 'body' -> '_embedded' -> 'leads', '[]')) loop
        select coalesce(
                 (select c ->> 'id' from jsonb_array_elements(lead -> '_embedded' -> 'contacts') c
                   where (c ->> 'is_main')::boolean limit 1),
                 lead -> '_embedded' -> 'contacts' -> 0 ->> 'id')
          into cid;
        por_lead := por_lead || jsonb_build_object(lead ->> 'id',
          jsonb_build_object('contacto', cid, 'nombre', lead ->> 'name'));
      end loop;

      contactos := '{}'::jsonb;
      if exists (select 1 from jsonb_each(por_lead) e where e.value ->> 'contacto' is not null) then
        resp := kommo_http(integ.company_id, '/api/v4/contacts',
          (select string_agg(distinct 'filter[id][]=' || (e.value ->> 'contacto'), '&')
             from jsonb_each(por_lead) e where e.value ->> 'contacto' is not null) || '&limit=250');
        for contacto in select value from jsonb_array_elements(coalesce(resp -> 'body' -> '_embedded' -> 'contacts', '[]')) loop
          select regexp_replace(coalesce(f -> 'values' -> 0 ->> 'value', ''), '\D', '', 'g')
            into telefono
            from jsonb_array_elements(coalesce(contacto -> 'custom_fields_values', '[]')) f
           where f ->> 'field_code' = 'PHONE'
           limit 1;
          if length(telefono) = 12 and telefono like '57%' then
            telefono := substr(telefono, 3);
          end if;
          contactos := contactos || jsonb_build_object(contacto ->> 'id',
            jsonb_build_object('nombre', contacto ->> 'name', 'celular', nullif(telefono, '')));
          telefono := null;
        end loop;
      end if;

      update appointments a
         set nombre  = coalesce(nullif(trim(contactos -> (por_lead -> a.external_lead_id::text ->> 'contacto') ->> 'nombre'), ''),
                                nullif(trim(por_lead -> a.external_lead_id::text ->> 'nombre'), ''),
                                a.nombre),
             celular = coalesce(contactos -> (por_lead -> a.external_lead_id::text ->> 'contacto') ->> 'celular', a.celular),
             kommo_completado = true
       where a.company_id = integ.company_id and a.source = 'kommo'
         and not a.kommo_completado and a.external_lead_id = any (ids);

      total := total + cardinality(ids);
    exception when others then
      update kommo_integrations set last_error = 'Completar contactos: ' || sqlerrm
       where company_id = integ.company_id;
    end;
  end loop;
  return total;
end;
$$;

revoke execute on function kommo_completar_contactos() from public, anon, authenticated;

create extension if not exists pg_cron;

select cron.schedule(
  'kommo-completar-contactos',
  '*/2 * * * *',
  $$select public.kommo_completar_contactos()$$
);
