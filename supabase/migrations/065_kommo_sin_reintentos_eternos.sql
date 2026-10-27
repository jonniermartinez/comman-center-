-- ============================================================
-- Command Center · 065 · Completar clientes de Kommo sin reintentos eternos
--
-- Entre el 23 y el 27 de octubre la base se quedó sin aire en horas de uso y
-- la app se quedaba cargando. Una de las causas era esta tarea:
--
-- - Kommo manda `"custom_fields_values": null` en los contactos sin campos.
--   `coalesce` no atrapa ese null (es un null de JSON, no de SQL), así que
--   `jsonb_array_elements` fallaba con "cannot extract elements from a
--   scalar". El error se tragaba, las 50 agendas quedaban pendientes y a los
--   dos minutos se volvían a pedir a Kommo. Para siempre: más de 4.000 agendas
--   en ese ciclo.
-- - Cada vuelta hace llamadas HTTP desde la base y mantiene ocupada una
--   conexión hasta 7 segundos por llamada.
--
-- Ahora cualquier lista que venga de Kommo se lee como lista solo si lo es,
-- cada agenda tiene un contador de intentos y, después de 5 vueltas fallidas,
-- deja de pedirse. La tarea corre cada 5 minutos en vez de cada 2.
-- ============================================================

alter table appointments add column if not exists kommo_intentos smallint not null default 0;

comment on column appointments.kommo_intentos is
  'Veces que kommo_completar_contactos intentó traer el contacto. A las 5 se deja de pedir.';

-- Un arreglo de JSON o uno vacío. Kommo usa null de JSON para "no hay".
create or replace function kommo_lista(valor jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select case when jsonb_typeof(valor) = 'array' then valor else '[]'::jsonb end;
$$;

create or replace function kommo_completar_contactos()
returns integer
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
    select jsonb_agg(jsonb_build_object('id', id, 'lead', external_lead_id, 'contacto', external_contact_id))
      into pend
      from (
        select id, external_lead_id, external_contact_id
          from appointments
         where company_id = integ.company_id and source = 'kommo' and not kommo_completado
           and kommo_intentos < 5
         order by scheduled_at desc
         limit 50
      ) x;
    if pend is null then
      continue;
    end if;

    -- Fuera del bloque de excepción: si la vuelta falla, el intento queda.
    update appointments a
       set kommo_intentos = a.kommo_intentos + 1
      from jsonb_array_elements(pend) e
     where a.id = (e ->> 'id')::uuid;

    begin
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
        for lead in select value from jsonb_array_elements(kommo_lista(resp -> 'body' -> '_embedded' -> 'leads')) loop
          de_lead := de_lead || jsonb_build_object(lead ->> 'id', coalesce(
            (select c ->> 'id' from jsonb_array_elements(kommo_lista(lead -> '_embedded' -> 'contacts')) c
              where (c ->> 'is_main')::boolean limit 1),
            kommo_lista(lead -> '_embedded' -> 'contacts') -> 0 ->> 'id'));
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
        for contacto in select value from jsonb_array_elements(kommo_lista(resp -> 'body' -> '_embedded' -> 'contacts')) loop
          telefono := null;
          select regexp_replace(coalesce(kommo_lista(f -> 'values') -> 0 ->> 'value', ''), '\D', '', 'g')
            into telefono
            from jsonb_array_elements(kommo_lista(contacto -> 'custom_fields_values')) f
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

select cron.alter_job(
  (select jobid from cron.job where jobname = 'kommo-completar-contactos'),
  schedule := '*/5 * * * *'
);
