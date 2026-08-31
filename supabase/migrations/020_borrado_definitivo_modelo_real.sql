-- ============================================================
-- El borrado definitivo vuelve a apuntar a las tablas que existen.
--
-- La 008 se escribio contra el modelo viejo —daily_kpi, daily_management,
-- sales_entries, billing_entries, collection_entries— que la 011 y la 013
-- reemplazaron por sales, payments, cash_movements, appointments y
-- daily_activity. Las dos funciones quedaron nombrando tablas que ya no
-- existen, asi que fallaban con "relation daily_kpi does not exist": la
-- confirmacion se quedaba contando para siempre y no habia forma de eliminar
-- una empresa.
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
    'sedes',       (select count(*) from branches       where company_id = target_company),
    'usuarios',    (select count(*) from company_users  where company_id = target_company),
    'comerciales', (select count(*) from company_staff  where company_id = target_company),
    'actividad',   (select count(*) from daily_activity where company_id = target_company),
    'ventas',      (select count(*) from sales          where company_id = target_company),
    'pagos',       (select count(*) from payments       where company_id = target_company),
    'caja',        (select count(*) from cash_movements where company_id = target_company),
    'agendas',     (select count(*) from appointments   where company_id = target_company),
    'objetivos',   (select count(*) from objectives     where company_id = target_company)
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

  -- Orden impuesto por las llaves foraneas: primero los pagos, que cuelgan de
  -- las ventas; despues todo lo que apunta a sedes y empresa; al final, la
  -- empresa. Las personas de `staff` no se tocan: son globales y pueden estar
  -- en varias empresas.
  delete from payments                where company_id = target_company;
  delete from sales                   where company_id = target_company;
  delete from appointments            where company_id = target_company;
  delete from cash_movements          where company_id = target_company;
  delete from daily_activity          where company_id = target_company;
  delete from objectives              where company_id = target_company;
  delete from company_users           where company_id = target_company;
  delete from company_staff           where company_id = target_company;
  delete from company_modules         where company_id = target_company;
  delete from company_financing_types where company_id = target_company;
  delete from company_payment_methods where company_id = target_company;
  delete from branches                where company_id = target_company;
  delete from companies               where id = target_company;

  return jsonb_build_object('name', empresa.name) || conteos;
end;
$$;
