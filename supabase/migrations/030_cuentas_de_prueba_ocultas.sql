-- ============================================================
-- Command Center · 030 · Las cuentas de prueba no se le muestran al cliente
--
-- Las pruebas automatizadas dejan un plantel fijo de cuentas
-- (e2e_command_*@jonnier.com) que hacen falta para que las pruebas corran
-- contra el proyecto de verdad. En la pantalla de Usuarios aparecian mezcladas
-- con la gente real del cliente: diez filas "E2E Asesor A1", "E2E Coordinador
-- B"... que no le dicen nada a nadie y ensucian la unica pantalla donde se
-- administra al equipo.
--
-- No se borran ni se marcan: se esconden por RLS, que es lo unico que no se
-- puede saltar desde el cliente. Las ven tres:
--
--   * la propia cuenta de prueba, que necesita leerse a si misma para tener
--     sesion;
--   * las demas cuentas de prueba, o las pruebas dejarian de verse entre ellas
--     y se caerian todas;
--   * la cuenta que administra la plataforma.
--
-- Para cualquier otro admin, incluido un super admin del cliente, no existen.
-- ============================================================

/* El mismo patron que ya usa purge_test_user, en un solo sitio. */
create or replace function es_cuenta_de_prueba(correo text)
returns boolean
language sql
immutable
as $$
  select coalesce(correo, '') ~ '^e2e[_-][a-z0-9_.-]+@jonnier\.com$';
$$;

/*
 * Quien puede ver el plantel de pruebas.
 *
 * Va como security definer porque consulta profiles, la misma tabla cuya
 * politica de lectura la llama: sin definer la politica se llamaria a si misma.
 */
create or replace function ve_cuentas_de_prueba()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = (select auth.uid())
      and (email = 'jonnieralejandrom@gmail.com' or es_cuenta_de_prueba(email))
  );
$$;

revoke all on function es_cuenta_de_prueba(text) from public, anon;
revoke all on function ve_cuentas_de_prueba() from public, anon;
grant execute on function es_cuenta_de_prueba(text) to authenticated, service_role;
grant execute on function ve_cuentas_de_prueba() to authenticated, service_role;

-- La primera mitad es la regla de siempre: te ves a ti, el super admin ve a
-- todos, y los companeros de empresa se ven entre si. La segunda es el filtro
-- nuevo, y se aplica encima.
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles
  for select using (
    (
      id = (select auth.uid())
      or is_super_admin()
      or (is_active_user() and shares_company(id))
    )
    and (
      not es_cuenta_de_prueba(email)
      or id = (select auth.uid())
      or ve_cuentas_de_prueba()
    )
  );

/* Si la persona no existe para ti, su asignacion a una empresa tampoco: sin
 * esto el Equipo de una empresa mostraria filas sin nombre. */
create or replace function usuario_es_de_prueba(usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = usuario and es_cuenta_de_prueba(email)
  );
$$;

revoke all on function usuario_es_de_prueba(uuid) from public, anon;
grant execute on function usuario_es_de_prueba(uuid) to authenticated, service_role;

drop policy if exists company_users_select on company_users;
create policy company_users_select on company_users
  for select using (
    (
      is_super_admin()
      or has_company_access(company_id)
      or user_id = (select auth.uid())
    )
    and (
      not usuario_es_de_prueba(user_id)
      or user_id = (select auth.uid())
      or ve_cuentas_de_prueba()
    )
  );

/* La auditoria es de lo que mas ruido acumula: una corrida de pruebas deja
 * cientos de lineas de "E2E Super Admin" que tapan lo que hizo una persona. */
drop policy if exists audit_log_select on audit_log;
create policy audit_log_select on audit_log
  for select using (
    is_super_admin()
    and (
      actor_id is null
      or not usuario_es_de_prueba(actor_id)
      or ve_cuentas_de_prueba()
    )
  );
