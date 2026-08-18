-- ============================================================
-- Command Center · 006 · Superficie de la API
--
-- Ninguna de estas funciones tiene por qué ser invocable sin sesión vía
-- /rest/v1/rpc. Las de trigger no se llaman nunca desde fuera; los helpers de
-- RLS solo los necesita un usuario autenticado (Postgres verifica el permiso de
-- EXECUTE también cuando la función se evalúa dentro de una política, así que
-- revocárselo a `authenticated` rompería toda lectura).
-- ============================================================
do $$
declare f text;
begin
  foreach f in array array[
    'handle_new_auth_user()', 'handle_auth_user_confirmed()',
    'set_updated_at()', 'fill_responsable_nombre()',
    'reject_deleted_responsable()', 'reject_future_date()'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'is_super_admin()', 'is_active_user()', 'my_role()', 'my_status()',
    'company_role(uuid)', 'has_company_access(uuid)', 'shares_company(uuid)',
    'can_manage_company(uuid)', 'me()',
    'soft_delete_user(uuid)', 'restore_user(uuid)'
  ]
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
