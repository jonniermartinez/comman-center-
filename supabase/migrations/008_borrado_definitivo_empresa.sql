-- ============================================================
-- Borrado definitivo de una empresa y de todos sus datos.
--
-- Es la excepcion a la regla de que aca nada se borra. El camino normal sigue
-- siendo archivar: esto es para deshacer una empresa creada por error o para
-- sacar del sistema a un cliente que ya no lo es. No hay vuelta atras.
--
-- Va en la base y no en la aplicacion por dos razones: el orden de borrado lo
-- imponen las llaves foraneas (todas son ON DELETE RESTRICT a proposito, para
-- que nada se borre por accidente en cascada), y asi la verificacion de que
-- quien lo pide es super admin ocurre del lado de Postgres, no de la interfaz.
-- ============================================================

-- Cuanto se va a perder. Se muestra en la confirmacion: borrar tiene que ser
-- una decision informada, no un boton mas.
create or replace function company_data_counts(target_company uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'sedes',       (select count(*) from branches           where company_id = target_company),
    'usuarios',    (select count(*) from company_users      where company_id = target_company),
    'kpi',         (select count(*) from daily_kpi          where company_id = target_company),
    'gestion',     (select count(*) from daily_management   where company_id = target_company),
    'ventas',      (select count(*) from sales_entries      where company_id = target_company),
    'facturacion', (select count(*) from billing_entries    where company_id = target_company),
    'recaudo',     (select count(*) from collection_entries where company_id = target_company),
    'objetivos',   (select count(*) from objectives         where company_id = target_company)
  )
  where is_super_admin();
$$;

create or replace function delete_company_cascade(target_company uuid, confirm_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor    uuid := (select auth.uid());
  empresa  record;
  conteos  jsonb;
begin
  if not is_super_admin() then
    raise exception 'Solo el super admin puede eliminar una empresa';
  end if;

  select id, name, slug into empresa from companies where id = target_company;
  if empresa.id is null then
    raise exception 'La empresa no existe';
  end if;

  -- El nombre escrito tiene que coincidir. Es la ultima red: un clic de mas no
  -- puede llevarse anos de registros.
  if lower(trim(confirm_name)) is distinct from lower(trim(empresa.name)) then
    raise exception 'El nombre no coincide con %', empresa.name;
  end if;

  conteos := company_data_counts(target_company);

  -- El log sobrevive a la empresa: se suelta la referencia en vez de borrarlo,
  -- porque la evidencia de que esto paso es justamente lo que no debe perderse.
  update audit_log set company_id = null where company_id = target_company;

  insert into audit_log (actor_id, actor_name, action, entity, entity_id, before, after)
  select actor, p.full_name, 'purge', 'companies', target_company::text,
         jsonb_build_object('name', empresa.name, 'slug', empresa.slug) || conteos,
         null
  from profiles p where p.id = actor;

  -- Orden impuesto por las llaves foraneas: primero lo que apunta a sedes y
  -- empresa, al final la empresa.
  delete from daily_kpi              where company_id = target_company;
  delete from daily_management       where company_id = target_company;
  delete from sales_entries          where company_id = target_company;
  delete from billing_entries        where company_id = target_company;
  delete from collection_entries     where company_id = target_company;
  delete from objectives             where company_id = target_company;
  delete from company_users          where company_id = target_company;
  delete from company_modules        where company_id = target_company;
  delete from company_financing_types where company_id = target_company;
  delete from company_payment_methods where company_id = target_company;
  delete from branches               where company_id = target_company;
  delete from companies              where id = target_company;

  return jsonb_build_object('name', empresa.name) || conteos;
end;
$$;

revoke all on function company_data_counts(uuid)      from public, anon;
revoke all on function delete_company_cascade(uuid, text) from public, anon;
grant execute on function company_data_counts(uuid)      to authenticated;
grant execute on function delete_company_cascade(uuid, text) to authenticated;
