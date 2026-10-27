-- ============================================================
-- Command Center · 067 · Los datos de referencia en una sola consulta
--
-- El layout de la app (`loadSnapshot`) pedía 17 tablas en 17 peticiones a
-- PostgREST cada vez que se renderizaba: 17 viajes de ida y vuelta desde el
-- Worker, 17 conexiones a tomar del pool y 17 veces evaluar la sesión en las
-- políticas. Con ~90.000 peticiones diarias eso eran millones de consultas.
--
-- `snapshot()` devuelve lo mismo en un solo JSON. Es `security invoker`: corre
-- con los permisos de quien llama, así que las políticas RLS siguen decidiendo
-- qué filas ve cada usuario, exactamente como cuando eran 17 selects.
-- ============================================================

create or replace function snapshot()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'profiles', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from profiles t),
    'staff', (select coalesce(jsonb_agg(to_jsonb(t) order by t.full_name), '[]') from staff t),
    'company_staff', (select coalesce(jsonb_agg(jsonb_build_object(
        'company_id', t.company_id, 'staff_id', t.staff_id, 'branch_id', t.branch_id)), '[]')
      from company_staff t),
    'companies', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from companies t),
    'branches', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from branches t),
    'company_modules', (select coalesce(jsonb_agg(jsonb_build_object(
        'company_id', t.company_id, 'module_code', t.module_code)), '[]')
      from company_modules t),
    'company_users', (select coalesce(jsonb_agg(jsonb_build_object(
        'company_id', t.company_id, 'user_id', t.user_id, 'branch_id', t.branch_id,
        'role', t.role, 'removed_at', t.removed_at, 'puede_editar', t.puede_editar)), '[]')
      from company_users t),
    'financing_types', (select coalesce(jsonb_agg(to_jsonb(t) order by t.sort_order), '[]') from financing_types t),
    'payment_methods', (select coalesce(jsonb_agg(to_jsonb(t) order by t.sort_order), '[]') from payment_methods t),
    'products', (select coalesce(jsonb_agg(jsonb_build_object(
        'code', t.code, 'name', t.name, 'sort_order', t.sort_order) order by t.sort_order), '[]')
      from products t),
    'schools', (select coalesce(jsonb_agg(to_jsonb(t) order by t.sort_order), '[]') from schools t),
    'channels', (select coalesce(jsonb_agg(to_jsonb(t) order by t.sort_order), '[]') from channels t),
    'sale_states', (select coalesce(jsonb_agg(to_jsonb(t) order by t.sort_order), '[]') from sale_states t),
    'cash_concepts', (select coalesce(jsonb_agg(to_jsonb(t) order by t.sort_order), '[]') from cash_concepts t),
    'company_financing_types', (select coalesce(jsonb_agg(jsonb_build_object(
        'company_id', t.company_id, 'financing_code', t.financing_code, 'active', t.active)), '[]')
      from company_financing_types t),
    'company_payment_methods', (select coalesce(jsonb_agg(jsonb_build_object(
        'company_id', t.company_id, 'method_code', t.method_code, 'active', t.active)), '[]')
      from company_payment_methods t),
    'metrics', (select coalesce(jsonb_agg(to_jsonb(t) order by t.sort_order), '[]') from metrics t)
  );
$$;

revoke all on function snapshot() from public, anon;
grant execute on function snapshot() to authenticated;
