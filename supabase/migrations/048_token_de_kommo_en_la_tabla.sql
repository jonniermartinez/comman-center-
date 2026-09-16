-- ============================================================
-- Command Center · 048 · El token de Kommo va en la tabla
--
-- Vault era una pieza más que podía fallar (un secreto huérfano, un nombre
-- repetido al reconectar) y no aportaba lo que se buscaba: que nadie de la
-- aplicación pueda leer el token. Eso lo da igual un permiso de columna.
--
-- El token queda en `kommo_integrations.token`, y a `anon` y `authenticated`
-- se les quita el SELECT de esa columna. Las funciones `security definer` lo
-- siguen leyendo; la API no lo devuelve aunque la fila sea visible.
-- ============================================================

alter table kommo_integrations add column if not exists token text;

update kommo_integrations k
   set token = s.decrypted_secret
  from vault.decrypted_secrets s
 where s.id = k.token_secret_id and k.token is null;

drop trigger if exists kommo_integrations_borrar_secreto on kommo_integrations;
drop function if exists kommo_borrar_secreto();

delete from vault.secrets where name like 'kommo_token_%';

alter table kommo_integrations drop column if exists token_secret_id;
alter table kommo_integrations alter column token set not null;

revoke select on kommo_integrations from anon, authenticated;
grant select (
  company_id, subdomain, token_hint, config, last_sync_at, last_sync_count, last_error,
  webhook_ultimo_at, created_by, created_at, updated_by, updated_at
) on kommo_integrations to authenticated;

create or replace function kommo_conectar(p_company uuid, p_subdomain text, p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sub   text := lower(trim(p_subdomain));
  token text := trim(p_token);
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

  insert into kommo_integrations (company_id, subdomain, token, token_hint, created_by, updated_by)
  values (p_company, sub, token, right(token, 4), auth.uid(), auth.uid())
  on conflict (company_id) do update
     set subdomain  = excluded.subdomain,
         token      = excluded.token,
         token_hint = excluded.token_hint,
         last_error = null,
         updated_by = excluded.updated_by;
end;
$$;

create or replace function kommo_http(p_company uuid, p_path text, p_query text default '')
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  integ     kommo_integrations;
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

  perform http_set_curlopt('CURLOPT_TIMEOUT', '7');

  respuesta := http((
    'GET',
    'https://' || integ.subdomain || '.kommo.com' || p_path
      || case when query = '' then '' else '?' || query end,
    array[http_header('Authorization', 'Bearer ' || integ.token)],
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
