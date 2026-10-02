-- ============================================================
-- Command Center · 057 · Las escuelas son de cada empresa
--
-- `schools` era una lista global que se armó sola al importar los Excel: cada
-- valor distinto de la columna "Escuela" quedó como opción, para todas las
-- empresas por igual y sin forma de editarla. Por eso el formulario de venta
-- de Atenas ofrecía "CEA Eduvial", "Auto Go" y "CEA AUTOGO" a la vez, y hasta
-- "En Proceso", que es un estado y no una escuela.
--
-- Ahora cada empresa tiene su lista y la administra desde Configuración. El
-- catálogo global se queda como diccionario de códigos, porque las ventas
-- históricas lo referencian; lo que cambia es qué se le ofrece a cada quien.
--
-- La lista de cada empresa arranca con las escuelas a las que ya le vendió.
-- ============================================================
create table if not exists company_schools (
  company_id  uuid not null references companies (id) on delete cascade,
  school_code text not null references schools (code),
  name        text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references profiles (id),
  primary key (company_id, school_code)
);

comment on table company_schools is
  'Las escuelas que una empresa ofrece al registrar una venta. Se administran en Configuración; inactiva no se borra, para que las ventas viejas la sigan nombrando.';

drop trigger if exists company_schools_set_updated_at on company_schools;
create trigger company_schools_set_updated_at before update on company_schools
  for each row execute function set_updated_at();

alter table company_schools enable row level security;

drop policy if exists company_schools_select on company_schools;
create policy company_schools_select on company_schools
  for select using (company_id in (select my_company_ids()));
drop policy if exists company_schools_update on company_schools;
create policy company_schools_update on company_schools
  for update using (can_manage_company(company_id)) with check (can_manage_company(company_id));
-- Sin política de insert: las altas entran por `company_school_add`, que
-- además crea el código en el catálogo global si no existía.

-- Lo que cada empresa ya vendió. "En Proceso" es un estado que se coló en la
-- columna equivocada: entra apagada para que no se ofrezca.
insert into company_schools (company_id, school_code, name, active)
select distinct s.company_id, sc.code, sc.name, sc.code <> 'en_proceso'
  from sales s
  join schools sc on sc.code = s.school_code
on conflict (company_id, school_code) do nothing;

create or replace function company_school_add(p_company uuid, p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_code text;
begin
  if not can_manage_company(p_company) then
    raise exception 'No tienes permiso para administrar esta empresa';
  end if;
  if v_name = '' then
    raise exception 'Escribe el nombre de la escuela';
  end if;

  -- El mismo código que usa la importación: sin tildes, minúsculas, con "_".
  v_code := btrim(regexp_replace(lower(translate(v_name,
              'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')), '[^a-z0-9]+', '_', 'g'), '_');
  if v_code = '' then
    raise exception 'El nombre de la escuela no es válido';
  end if;

  insert into schools (code, name, sort_order)
  values (v_code, v_name, (select coalesce(max(sort_order), 0) + 1 from schools))
  on conflict (code) do nothing;

  insert into company_schools (company_id, school_code, name, active, updated_by)
  values (p_company, v_code, v_name, true, auth.uid())
  on conflict (company_id, school_code)
  do update set active = true, name = excluded.name, updated_by = auth.uid();

  return v_code;
end;
$$;

revoke all on function company_school_add(uuid, text) from public, anon;
grant execute on function company_school_add(uuid, text) to authenticated, service_role;
