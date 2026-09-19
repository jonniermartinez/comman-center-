-- ============================================================
-- Command Center · 052 · La jornada no pisa lo que contaron las agendas
--
-- 051 hizo que cada tipificación sumara sola en `daily_activity`. Faltaba la
-- otra mitad: el formulario de Gestión Diaria sigue pidiendo esos cinco
-- contadores a mano y guarda con `upsert`. Sin esto, un comercial que tipifica
-- sus agendas por la mañana y cierra su jornada por la tarde borra lo que
-- contó la aplicación y lo reemplaza por lo que se acuerde.
--
-- La regla: el día que alguien gestionó agendas en la aplicación, esos cinco
-- números son de las tipificaciones. No se discuten desde el formulario.
--
-- Se marca la fila en vez de deducirlo de la empresa o del módulo: lo que
-- importa no es si el módulo está activo, es si ESTE día de ESTA persona se
-- contó solo. Un día viejo, cargado del Excel, se sigue corrigiendo a mano.
-- ============================================================

alter table daily_activity
  add column if not exists agendas_automaticas boolean not null default false;

comment on column daily_activity.agendas_automaticas is
  'Los cinco contadores agenda_* de esta fila los escribieron las tipificaciones del módulo de Agendas. El formulario no los toca.';

-- ------------------------------------------------------------
-- El trigger de 051, ahora marcando la fila
-- ------------------------------------------------------------
-- Cambia en dos cosas: deja `agendas_automaticas` en true, y avisa —con una
-- variable de la transacción— que este `update` viene de una tipificación, no
-- del formulario. Sin ese aviso, el guardián de abajo desharía el incremento
-- que acaba de hacer.
create or replace function agenda_sumar_a_jornada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_columna text;
  v_staff   uuid;
  v_nombre  text;
  v_branch  uuid;
  v_fecha   date := (now() at time zone 'America/Bogota')::date;
begin
  v_columna := case new.tipo
    when 'confirma'    then 'agenda_confirmada'
    when 'posible'     then 'agenda_posible'
    when 'reprograma'  then 'agenda_reprograma'
    when 'no_contesta' then 'agenda_no_contesta'
    when 'cancela'     then 'agenda_cancela'
  end;
  if v_columna is null then
    return new;
  end if;

  select s.id, s.full_name into v_staff, v_nombre
    from staff s
    join company_staff cs on cs.staff_id = s.id and cs.company_id = new.company_id
   where s.profile_id = new.actor;
  if v_staff is null then
    return new;
  end if;

  select branch_id into v_branch from appointments where id = new.appointment_id;

  perform set_config('app.agendas_sumando', '1', true);

  execute format($f$
    insert into daily_activity (company_id, branch_id, report_date, period_month,
                                staff_id, responsable_nombre, %I,
                                agendas_automaticas, created_by, updated_by)
    values ($1, $2, $3, date_trunc('month', $3::date)::date, $4, $5, 1, true, $6, $6)
    on conflict (company_id, branch_id, report_date, staff_id)
    do update set %I = daily_activity.%I + 1,
                  agendas_automaticas = true,
                  updated_by = $6, updated_at = now()
  $f$, v_columna, v_columna, v_columna)
  using new.company_id, v_branch, v_fecha, v_staff, v_nombre, new.actor;

  perform set_config('app.agendas_sumando', '0', true);

  return new;
end;
$$;

revoke execute on function agenda_sumar_a_jornada() from public, anon, authenticated;

-- ------------------------------------------------------------
-- El guardián
-- ------------------------------------------------------------
-- Cualquier `update` sobre una fila ya contada deja los cinco contadores como
-- estaban. No falla ni avisa: el formulario manda la jornada entera de una
-- vez, y rechazarla por cinco casillas que ni siquiera se editaron perdería
-- las otras cuarenta. El único que pasa es el de la tipificación, que se
-- identifica con la variable que puso el trigger de arriba.
create or replace function daily_activity_conservar_agendas()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.agendas_sumando', true), '0') = '1' then
    return new;
  end if;
  if not old.agendas_automaticas then
    return new;
  end if;

  new.agenda_confirmada   := old.agenda_confirmada;
  new.agenda_posible      := old.agenda_posible;
  new.agenda_reprograma   := old.agenda_reprograma;
  new.agenda_no_contesta  := old.agenda_no_contesta;
  new.agenda_cancela      := old.agenda_cancela;
  new.agendas_automaticas := true;
  return new;
end;
$$;

revoke execute on function daily_activity_conservar_agendas() from public, anon, authenticated;

-- Va antes que `set_updated_at` por orden alfabético del nombre, que es como
-- Postgres decide: no importa cuál corra primero, pero conviene saberlo.
drop trigger if exists daily_activity_conservar_agendas on daily_activity;
create trigger daily_activity_conservar_agendas
  before update on daily_activity
  for each row execute function daily_activity_conservar_agendas();

-- ------------------------------------------------------------
-- Que la pantalla pueda saberlo
-- ------------------------------------------------------------
-- El formulario de Gestión Diaria lee `v_daily_activity`. Con la marca en la
-- vista, puede enseñar esos cinco contadores apagados y explicar por qué, en
-- vez de dejar que alguien los edite y después descubra que no se guardaron.
--
-- La columna se agrega al final de la lista: `create or replace view` no deja
-- cambiar el orden de las que ya existen, y la cirugía sobre el texto de la
-- definición evita repetir acá las sesenta columnas de 044.
do $$
declare
  def text;
begin
  select pg_get_viewdef('public.v_daily_activity'::regclass, true) into def;
  if def like '%agendas_automaticas%' then
    return;
  end if;
  def := replace(def, '   FROM daily_activity a', ',
    a.agendas_automaticas
   FROM daily_activity a');
  execute 'create or replace view v_daily_activity with (security_invoker = true) as ' || def;
end $$;
