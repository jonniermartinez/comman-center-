-- ============================================================
-- Command Center · 050 · La agenda es la tarea del calendario de Kommo
--
-- 046 y 047 dejaban elegir entre tres lecturas (etapa del lead, campo de fecha,
-- tarea). En Command Center una agenda es una sola cosa: la tarea con fecha y
-- hora que se ve en el calendario de Kommo. Los datos del lead no se traen.
--
-- - El webhook solo aplica avisos de tareas (`task` add/update). Cualquier
--   otro aviso se guarda crudo en `kommo_eventos` y no hace nada más.
-- - La tarea puede estar ligada a un lead (element_type 2) o a un contacto
--   (element_type 1). Del lead no se guarda nada: solo se usa para llegar a su
--   contacto, que es de donde salen nombre y celular.
-- - `tipo_tarea_id` es opcional: sin él, cualquier tarea es una agenda.
-- - El resultado de la agenda ya no sale de la etapa del lead. Queda el texto
--   de la tarea y, al completarla, lo que se escribió como resultado.
-- ============================================================

alter table appointments add column if not exists external_contact_id bigint;
comment on column appointments.external_contact_id is 'Id del contacto en Kommo, si la tarea está ligada directamente a un contacto.';

-- La configuración vieja con modo etapa o campo de fecha pasa a tarea.
update kommo_integrations
   set config = jsonb_build_object(
         'modo', 'tarea',
         'tipo_tarea_id', config -> 'tipo_tarea_id',
         'usuarios', coalesce(config -> 'usuarios', '{}'::jsonb),
         'branch_id', config -> 'branch_id'
       )
 where config ->> 'modo' is distinct from 'tarea' and config <> '{}'::jsonb;

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

  update kommo_integrations
     set config = p_config || jsonb_build_object('modo', 'tarea'), updated_by = auth.uid()
   where company_id = p_company;
  if not found then
    raise exception 'Esta empresa no tiene una cuenta de Kommo conectada';
  end if;
end;
$$;

-- ------------------------------------------------------------
-- Una tarea → una agenda
-- ------------------------------------------------------------
drop function if exists kommo_guardar_cita(uuid, jsonb, text, text, bigint, timestamptz, boolean, bigint, text, bigint, text);

create or replace function kommo_guardar_tarea(
  p_company     uuid,
  p_config      jsonb,
  p_subdomain   text,
  p_tarea       jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id        bigint := kommo_num(p_tarea ->> 'id');
  v_tipo_el   text   := coalesce(p_tarea ->> 'element_type', p_tarea ->> 'entity_type');
  v_elemento  bigint := kommo_num(coalesce(p_tarea ->> 'element_id', p_tarea ->> 'entity_id'));
  v_cuando    bigint := kommo_num(coalesce(p_tarea ->> 'complete_before', p_tarea ->> 'complete_till'));
  v_resp      bigint := kommo_num(p_tarea ->> 'responsible_user_id');
  v_lead      bigint;
  v_contacto  bigint;
  v_url       text;
  v_momento   timestamptz;
  v_staff     uuid;
  v_branch    uuid;
  v_nombre    text;
  v_resultado text;
begin
  if v_id is null or v_cuando is null then
    return false;
  end if;
  if p_config ->> 'tipo_tarea_id' is not null
     and coalesce(p_tarea ->> 'task_type', p_tarea ->> 'task_type_id') is distinct from p_config ->> 'tipo_tarea_id' then
    return false;
  end if;

  -- El webhook dice 2/1; la API dice leads/contacts.
  if v_tipo_el in ('2', 'leads') then
    v_lead := v_elemento;
    v_url  := 'https://' || p_subdomain || '.kommo.com/leads/detail/' || v_elemento;
  elsif v_tipo_el in ('1', 'contacts') then
    v_contacto := v_elemento;
    v_url      := 'https://' || p_subdomain || '.kommo.com/contacts/detail/' || v_elemento;
  else
    v_url := 'https://' || p_subdomain || '.kommo.com/todo/calendar/';
  end if;

  v_momento := to_timestamp(v_cuando);

  select cs.staff_id, cs.branch_id, s.full_name
    into v_staff, v_branch, v_nombre
    from company_staff cs
    join staff s on s.id = cs.staff_id
   where cs.company_id = p_company
     and cs.staff_id::text = p_config -> 'usuarios' ->> v_resp::text;

  if v_branch is null then
    select id into v_branch
      from branches
     where company_id = p_company and status = 'activa'
     order by (id::text = coalesce(p_config ->> 'branch_id', '')) desc, is_primary desc
     limit 1;
  end if;
  if v_branch is null then
    raise exception 'La empresa no tiene sedes activas';
  end if;

  -- Completada con resultado escrito: ese es el resultado de la agenda.
  if coalesce(p_tarea ->> 'status', '') = '1' or coalesce(p_tarea ->> 'is_completed', '') = 'true' then
    v_resultado := nullif(trim(coalesce(p_tarea -> 'result' ->> 'text', p_tarea ->> 'result')), '');
    v_resultado := coalesce(v_resultado, 'Completada');
  end if;

  insert into appointments as a (
    company_id, branch_id, scheduled_at, scheduled_time,
    staff_id, responsable_nombre, resultado, observacion,
    source, external_id, external_lead_id, external_contact_id, external_url
  )
  values (
    p_company, v_branch,
    (v_momento at time zone 'America/Bogota')::date,
    (v_momento at time zone 'America/Bogota')::time,
    v_staff, v_nombre, v_resultado, nullif(trim(p_tarea ->> 'text'), ''),
    'kommo', 'tarea:' || v_id, v_lead, v_contacto, v_url
  )
  on conflict (company_id, external_id) where source = 'kommo'
  do update set
    scheduled_at        = excluded.scheduled_at,
    scheduled_time      = excluded.scheduled_time,
    staff_id            = excluded.staff_id,
    responsable_nombre  = excluded.responsable_nombre,
    branch_id           = excluded.branch_id,
    resultado           = coalesce(excluded.resultado, a.resultado),
    observacion         = coalesce(excluded.observacion, a.observacion),
    external_lead_id    = excluded.external_lead_id,
    external_contact_id = excluded.external_contact_id,
    external_url        = excluded.external_url,
    -- Si la tarea cambió de lead o contacto, hay que volver a buscar el cliente.
    kommo_completado    = a.kommo_completado
                          and a.external_lead_id is not distinct from excluded.external_lead_id
                          and a.external_contact_id is not distinct from excluded.external_contact_id;
  return true;
end;
$$;

revoke execute on function kommo_guardar_tarea(uuid, jsonb, text, jsonb) from public, anon, authenticated;

create or replace function kommo_aplicar(p_company uuid, p_entidad text, p_accion text, p_item jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  integ kommo_integrations;
begin
  if p_entidad <> 'task' or p_accion not in ('add', 'update') then
    return;
  end if;
  select * into integ from kommo_integrations where company_id = p_company;
  perform kommo_guardar_tarea(p_company, integ.config, integ.subdomain, p_item);
end;
$$;

revoke execute on function kommo_aplicar(uuid, text, text, jsonb) from public, anon, authenticated;

-- ------------------------------------------------------------
-- Traer de Kommo: recibe las tareas tal como las da la API
-- ------------------------------------------------------------
drop function if exists kommo_guardar_citas(uuid, jsonb);

create or replace function kommo_guardar_tareas(p_company uuid, p_tareas jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  integ kommo_integrations;
  t     jsonb;
  n     int := 0;
begin
  if not can_manage_company(p_company) then
    raise exception 'No tienes permiso para sincronizar esta empresa';
  end if;
  select * into integ from kommo_integrations where company_id = p_company;
  if not found then
    raise exception 'Esta empresa no tiene una cuenta de Kommo conectada';
  end if;

  for t in select value from jsonb_array_elements(p_tareas) loop
    if kommo_guardar_tarea(p_company, integ.config, integ.subdomain, t) then
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;

revoke execute on function kommo_guardar_tareas(uuid, jsonb) from public, anon;
grant execute on function kommo_guardar_tareas(uuid, jsonb) to authenticated;

-- ------------------------------------------------------------
-- Nombre y celular del cliente de la tarea
--
-- Del lead solo se pide el id de su contacto principal; nada del lead se
-- guarda. Con el contacto (el de la tarea o el del lead) se llenan nombre y
-- celular.
-- ------------------------------------------------------------
create or replace function kommo_completar_contactos()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  integ     kommo_integrations;
  pend      jsonb;
  leads     bigint[];
  resp      jsonb;
  lead      jsonb;
  contacto  jsonb;
  de_lead   jsonb;
  contactos jsonb;
  ids_cont  text;
  telefono  text;
  total     int := 0;
begin
  for integ in select * from kommo_integrations loop
    begin
      -- Hasta 50 agendas por vuelta, para no pasar el límite de Kommo.
      select jsonb_agg(jsonb_build_object('id', id, 'lead', external_lead_id, 'contacto', external_contact_id))
        into pend
        from (
          select id, external_lead_id, external_contact_id
            from appointments
           where company_id = integ.company_id and source = 'kommo' and not kommo_completado
           order by scheduled_at desc
           limit 50
        ) x;
      if pend is null then
        continue;
      end if;

      de_lead := '{}'::jsonb;
      leads := array(
        select distinct (e ->> 'lead')::bigint
          from jsonb_array_elements(pend) e
         where e ->> 'lead' is not null
      );
      if cardinality(leads) > 0 then
        resp := kommo_http(integ.company_id, '/api/v4/leads',
          (select string_agg('filter[id][]=' || i, '&') from unnest(leads) i) || '&with=contacts&limit=250');
        if (resp ->> 'status')::int not in (200, 204) then
          raise exception 'Kommo respondió % al buscar el contacto de las tareas', resp ->> 'status';
        end if;
        for lead in select value from jsonb_array_elements(coalesce(resp -> 'body' -> '_embedded' -> 'leads', '[]')) loop
          de_lead := de_lead || jsonb_build_object(lead ->> 'id', coalesce(
            (select c ->> 'id' from jsonb_array_elements(lead -> '_embedded' -> 'contacts') c
              where (c ->> 'is_main')::boolean limit 1),
            lead -> '_embedded' -> 'contacts' -> 0 ->> 'id'));
        end loop;
      end if;

      select string_agg(distinct 'filter[id][]=' || x, '&') into ids_cont
        from (
          select coalesce(e ->> 'contacto', de_lead ->> (e ->> 'lead')) x
            from jsonb_array_elements(pend) e
        ) q
       where x is not null;

      contactos := '{}'::jsonb;
      if ids_cont is not null then
        resp := kommo_http(integ.company_id, '/api/v4/contacts', ids_cont || '&limit=250');
        if (resp ->> 'status')::int not in (200, 204) then
          raise exception 'Kommo respondió % al leer los contactos', resp ->> 'status';
        end if;
        for contacto in select value from jsonb_array_elements(coalesce(resp -> 'body' -> '_embedded' -> 'contacts', '[]')) loop
          telefono := null;
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
        end loop;
      end if;

      update appointments a
         set nombre  = coalesce(nullif(trim(contactos -> coalesce(e ->> 'contacto', de_lead ->> (e ->> 'lead')) ->> 'nombre'), ''), a.nombre),
             celular = coalesce(contactos -> coalesce(e ->> 'contacto', de_lead ->> (e ->> 'lead')) ->> 'celular', a.celular),
             kommo_completado = true
        from jsonb_array_elements(pend) e
       where a.id = (e ->> 'id')::uuid;

      total := total + jsonb_array_length(pend);
    exception when others then
      update kommo_integrations set last_error = 'Completar clientes: ' || sqlerrm
       where company_id = integ.company_id;
    end;
  end loop;
  return total;
end;
$$;

revoke execute on function kommo_completar_contactos() from public, anon, authenticated;

-- ------------------------------------------------------------
-- Instalar el webhook en Kommo sin entrar a Kommo
--
-- Genera el secreto, arma la dirección, borra de Kommo los webhooks viejos
-- que apuntaban a Command Center y registra el nuevo con los dos eventos de
-- tareas (POST /api/v4/webhooks). Necesita que el token sea de un
-- administrador de la cuenta, que es lo que exige Kommo para este método.
-- ------------------------------------------------------------
create or replace function kommo_instalar_webhook(p_company uuid, p_base_url text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  integ     kommo_integrations;
  base      text := rtrim(trim(p_base_url), '/');
  secreto   text := encode(gen_random_bytes(24), 'hex');
  destino   text;
  lista     extensions.http_response;
  resp      extensions.http_response;
  viejo     jsonb;
  cabeceras extensions.http_header[];
begin
  if not is_super_admin() then
    raise exception 'Solo el super admin instala el webhook';
  end if;
  if base !~ '^https://[a-z0-9.-]+(:[0-9]+)?$' or base ~ '^https://(localhost|127\.|10\.|192\.168\.)' then
    raise exception 'Kommo solo puede avisar a una dirección pública con https. Instálalo desde la aplicación publicada.';
  end if;

  select * into integ from kommo_integrations where company_id = p_company;
  if not found then
    raise exception 'Esta empresa no tiene una cuenta de Kommo conectada';
  end if;

  destino   := base || '/api/kommo/webhook/' || secreto;
  cabeceras := array[http_header('Authorization', 'Bearer ' || integ.token)];
  perform http_set_curlopt('CURLOPT_TIMEOUT', '7');

  -- Los que apuntaban a una dirección vieja de Command Center dejarían de
  -- funcionar con el secreto nuevo: se quitan para que Kommo no los apague
  -- por fallar.
  lista := http(('GET', 'https://' || integ.subdomain || '.kommo.com/api/v4/webhooks', cabeceras, null, null)::http_request);
  if lista.status = 200 then
    for viejo in
      select value from jsonb_array_elements(coalesce(lista.content::jsonb -> '_embedded' -> 'webhooks', '[]'))
       where value ->> 'destination' like '%/api/kommo/webhook/%'
    loop
      perform http(('DELETE', 'https://' || integ.subdomain || '.kommo.com/api/v4/webhooks', cabeceras,
                    'application/json', jsonb_build_object('destination', viejo ->> 'destination')::text)::http_request);
    end loop;
  elsif lista.status in (401, 403) then
    raise exception 'Kommo no dejó ver los webhooks (%). El token tiene que ser de un administrador de la cuenta.', lista.status;
  end if;

  resp := http(('POST', 'https://' || integ.subdomain || '.kommo.com/api/v4/webhooks', cabeceras,
                'application/json',
                jsonb_build_object('destination', destino, 'settings', jsonb_build_array('add_task', 'update_task'))::text
               )::http_request);
  if resp.status not in (200, 201) then
    raise exception 'Kommo no aceptó el webhook (%): %', resp.status, left(coalesce(resp.content, ''), 300);
  end if;

  update kommo_integrations
     set webhook_hash = encode(digest(secreto, 'sha256'), 'hex'), updated_by = auth.uid()
   where company_id = p_company;

  return destino;
end;
$$;

revoke execute on function kommo_instalar_webhook(uuid, text) from public, anon;
grant execute on function kommo_instalar_webhook(uuid, text) to authenticated;

-- ------------------------------------------------------------
-- Listado de agendas con muchas filas
--
-- La pantalla pagina en el servidor y filtra por fecha con
-- `appointments_company_fecha_idx`. Lo que no tenía índice era el buscador
-- (`ilike '%texto%'` sobre nombre y celular): con trigramas deja de recorrer
-- la tabla entera.
-- ------------------------------------------------------------
create extension if not exists pg_trgm with schema extensions;

create index if not exists appointments_nombre_trgm_idx
  on appointments using gin (nombre extensions.gin_trgm_ops);
create index if not exists appointments_celular_trgm_idx
  on appointments using gin (celular extensions.gin_trgm_ops);
