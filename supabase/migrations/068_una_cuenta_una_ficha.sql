-- ============================================================
-- Command Center · 068 · Una cuenta, una sola ficha
--
-- Nada impedía enlazar la misma cuenta con varias fichas de `staff`, y pasó:
-- tres fichas de una comercial quedaron colgando de las cuentas de dos
-- coordinadores. Con dos fichas, la cuenta ve registros que no son suyos y
-- `getCompanyContext` (que busca la ficha con `maybeSingle`) deja de
-- encontrarla.
--
-- Antes de aplicarla hay que limpiar los duplicados que existan; si queda
-- alguno, la migración se detiene y dice cuáles.
-- ============================================================

do $$
declare
  repetidas text;
begin
  select string_agg(profile_id::text || ' (' || n || ' fichas)', ', ')
    into repetidas
    from (
      select profile_id, count(*) as n
        from staff
       where profile_id is not null
       group by profile_id
      having count(*) > 1
    ) d;

  if repetidas is not null then
    raise exception 'Cuentas con más de una ficha, límpialas primero: %', repetidas;
  end if;
end $$;

drop index if exists staff_profile_idx;
create unique index staff_profile_idx on staff (profile_id) where profile_id is not null;
