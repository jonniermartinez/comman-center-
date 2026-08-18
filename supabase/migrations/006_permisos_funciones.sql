-- ============================================================
-- Superficie de la API: ninguna de estas funciones tiene por que ser
-- invocable sin sesion via /rest/v1/rpc. Las de trigger no se llaman nunca
-- desde fuera; los helpers de RLS solo los necesita un usuario autenticado
-- (Postgres verifica el permiso de EXECUTE tambien cuando la funcion se
-- evalua dentro de una politica).
-- ============================================================

-- Funciones de trigger: nadie las invoca directamente.
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

-- Helpers de RLS y acciones: solo con sesion iniciada.
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
