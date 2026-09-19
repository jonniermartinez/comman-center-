-- ============================================================
-- Command Center · 052 · Abrir, tipificar, cerrar
--
-- Las cinco puertas por las que la pantalla escribe una jornada. Son
-- `security definer` porque 051 dejó las tablas sin políticas de escritura:
-- cada una comprueba el permiso, escribe el evento, mueve la marca de tiempo
-- y deja que el trigger sume en el resumen. Las cuatro cosas o ninguna.
-- ============================================================

-- ------------------------------------------------------------
-- Quién puede tocar una jornada
-- ------------------------------------------------------------
-- La suya, y quien coordina la empresa. A diferencia de otras tablas acá no
-- hay término medio: una jornada es de una persona concreta, y registrar
-- llamadas en la de otro no es un caso de uso, es un error.
create or replace function puede_gestionar_jornada(p_jornada uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from jornadas j
     where j.id = p_jornada
       and (can_manage_company(j.company_id) or es_mi_registro(j.staff_id))
  );
$$;

revoke execute on function puede_gestionar_jornada(uuid) from public, anon;
grant execute on function puede_gestionar_jornada(uuid) to authenticated;

-- ------------------------------------------------------------
-- Abrir
-- ------------------------------------------------------------
-- Idempotente a propósito: si la persona ya abrió hoy, devuelve la que tiene
-- en vez de crear otra. Recargar la página o entrar desde el celular después
-- de haber empezado en el computador no puede partir el día en dos.
create or replace function jornada_abrir(p_company uuid, p_branch uuid, p_staff uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hoy   date := (now() at time zone 'America/Bogota')::date;
  v_id    uuid;
  v_actor uuid := auth.uid();
begin
  if not (can_manage_company(p_company) or es_mi_registro(p_staff)) then
    raise exception 'Solo puedes abrir tu propia jornada';
  end if;
  if not exists (select 1 from branches where id = p_branch and company_id = p_company) then
    raise exception 'Esa sede no es de esta empresa';
  end if;

  select id into v_id
    from jornadas
   where company_id = p_company and branch_id = p_branch
     and report_date = v_hoy and staff_id = p_staff;

  if v_id is not null then
    -- Reabrir la del día: se cerró por error, o se sigue después del almuerzo.
    update jornadas set fin = null, ultima_marca = now(), updated_by = v_actor
     where id = v_id and fin is not null;
    return v_id;
  end if;

  insert into jornadas (company_id, branch_id, staff_id, report_date, updated_by)
  values (p_company, p_branch, p_staff, v_hoy, v_actor)
  returning id into v_id;

  -- La hora de llegada del resumen es cuando abrió, no lo que recuerde luego.
  insert into daily_activity (company_id, branch_id, report_date, period_month,
                              staff_id, responsable_nombre, hora_llegada,
                              created_by, updated_by)
  values (p_company, p_branch, v_hoy, date_trunc('month', v_hoy)::date, p_staff,
          (select full_name from staff where id = p_staff),
          (now() at time zone 'America/Bogota')::time, v_actor, v_actor)
  on conflict (company_id, branch_id, report_date, staff_id)
  do update set hora_llegada = coalesce(daily_activity.hora_llegada, excluded.hora_llegada),
                updated_by = v_actor;

  return v_id;
end;
$$;

revoke execute on function jornada_abrir(uuid, uuid, uuid) from public, anon;
grant execute on function jornada_abrir(uuid, uuid, uuid) to authenticated;

-- ------------------------------------------------------------
-- Tipificar
-- ------------------------------------------------------------
-- Una puerta para las llamadas y las atenciones. La duración sale sola: es el
-- hueco entre la marca anterior y ahora. Nadie arranca ni para un cronómetro;
-- si acabas de colgar, el tiempo de esa llamada ya está medido.
create or replace function jornada_tipificar(
  p_jornada      uuid,
  p_clase        text,
  p_contestada   boolean,
  p_categoria    text,
  p_tipificacion text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  j       jornadas;
  v_actor uuid := auth.uid();
begin
  if not puede_gestionar_jornada(p_jornada) then
    raise exception 'Esa jornada no es tuya';
  end if;

  select * into j from jornadas where id = p_jornada;
  if j.fin is not null then
    raise exception 'Esa jornada ya está cerrada. Ábrela otra vez para seguir registrando.';
  end if;
  if j.pausa_tipo is not null then
    raise exception 'Termina la pausa antes de registrar una gestión';
  end if;
  if p_clase not in ('llamada', 'atencion') then
    raise exception 'Clase desconocida: %', p_clase;
  end if;

  -- Una llamada no contestada no se tipifica; todo lo demás sí, y la lista
  -- válida es la que `jornada_columna` sabe contar.
  if not (p_clase = 'llamada' and p_contestada is false)
     and jornada_columna(p_clase, p_contestada, p_categoria, p_tipificacion) is null then
    raise exception 'Esa tipificación no existe para % %', p_clase, coalesce(p_categoria, '');
  end if;

  insert into jornada_eventos (jornada_id, company_id, clase, contestada, categoria,
                               tipificacion, inicio, actor)
  values (p_jornada, j.company_id, p_clase,
          case when p_clase = 'llamada' then coalesce(p_contestada, false) else null end,
          p_categoria,
          case when p_clase = 'llamada' and p_contestada is false then null else p_tipificacion end,
          -- Una atención presencial no hereda el tiempo de espera de la
          -- llamada anterior: dura lo que dura la conversación, y mezclarlas
          -- inflaría el promedio por llamada.
          case when p_clase = 'atencion' then now() else j.ultima_marca end,
          v_actor);

  update jornadas set ultima_marca = now(), updated_by = v_actor where id = p_jornada;
end;
$$;

revoke execute on function jornada_tipificar(uuid, text, boolean, text, text) from public, anon;
grant execute on function jornada_tipificar(uuid, text, boolean, text, text) to authenticated;

-- ------------------------------------------------------------
-- Pausar y volver
-- ------------------------------------------------------------
-- `p_tipo` null termina la que esté corriendo. Al volver, la marca se pone en
-- ahora: el rato del almuerzo no puede contarse como una llamada larguísima.
create or replace function jornada_pausa(p_jornada uuid, p_tipo text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  j       jornadas;
  v_actor uuid := auth.uid();
begin
  if not puede_gestionar_jornada(p_jornada) then
    raise exception 'Esa jornada no es tuya';
  end if;
  select * into j from jornadas where id = p_jornada;

  if p_tipo is null then
    if j.pausa_tipo is null then
      return;
    end if;
    insert into jornada_eventos (jornada_id, company_id, clase, tipificacion, inicio, actor)
    values (p_jornada, j.company_id, 'pausa', j.pausa_tipo, j.pausa_inicio, v_actor);
    update jornadas
       set pausa_tipo = null, pausa_inicio = null, ultima_marca = now(), updated_by = v_actor
     where id = p_jornada;
    return;
  end if;

  if j.fin is not null then
    raise exception 'Esa jornada ya está cerrada';
  end if;
  if j.pausa_tipo is not null then
    raise exception 'Ya tienes una pausa en curso';
  end if;
  if p_tipo not in ('bano', 'capacitacion', 'almuerzo') then
    raise exception 'Tipo de pausa desconocido: %', p_tipo;
  end if;

  update jornadas set pausa_tipo = p_tipo, pausa_inicio = now(), updated_by = v_actor
   where id = p_jornada;
end;
$$;

revoke execute on function jornada_pausa(uuid, text) from public, anon;
grant execute on function jornada_pausa(uuid, text) to authenticated;

-- ------------------------------------------------------------
-- La cola del CRM, tres veces al día
-- ------------------------------------------------------------
-- Lo que se mide no es cuántos chats hay, es cuántos se depuraron: por eso se
-- toma al empezar, a media mañana y al cerrar. Va directo al resumen porque
-- no es un evento con duración, es una foto de un momento.
create or replace function jornada_crm(
  p_jornada   uuid,
  p_momento   text,
  p_chats     int,
  p_tareas    int,
  p_caducadas int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  j        jornadas;
  v_sufijo text;
  v_actor  uuid := auth.uid();
begin
  if not puede_gestionar_jornada(p_jornada) then
    raise exception 'Esa jornada no es tuya';
  end if;
  v_sufijo := case p_momento
    when 'inicial'   then 'inicial'
    when 'medio_dia' then 'medio'
    when 'final'     then 'final'
  end;
  if v_sufijo is null then
    raise exception 'Momento desconocido: %', p_momento;
  end if;
  if least(p_chats, p_tareas, p_caducadas) < 0 then
    raise exception 'La cola del CRM no puede ser negativa';
  end if;

  select * into j from jornadas where id = p_jornada;

  execute format($f$
    update daily_activity
       set chats_%1$s = $1, tareas_%1$s = $2, caducadas_%1$s = $3,
           updated_by = $4, updated_at = now()
     where company_id = $5 and branch_id = $6 and report_date = $7 and staff_id = $8
  $f$, v_sufijo)
  using p_chats, p_tareas, p_caducadas, v_actor,
        j.company_id, j.branch_id, j.report_date, j.staff_id;
end;
$$;

revoke execute on function jornada_crm(uuid, text, int, int, int) from public, anon;
grant execute on function jornada_crm(uuid, text, int, int, int) to authenticated;

-- ------------------------------------------------------------
-- Cerrar
-- ------------------------------------------------------------
-- Cierra la pausa que haya quedado abierta —alguien se fue a almorzar y no
-- volvió a tocar la pantalla— antes de poner la hora de salida.
create or replace function jornada_cerrar(p_jornada uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  j       jornadas;
  v_actor uuid := auth.uid();
begin
  if not puede_gestionar_jornada(p_jornada) then
    raise exception 'Esa jornada no es tuya';
  end if;

  perform jornada_pausa(p_jornada, null);

  select * into j from jornadas where id = p_jornada;
  update jornadas set fin = now(), updated_by = v_actor where id = p_jornada;

  update daily_activity
     set hora_salida = (now() at time zone 'America/Bogota')::time,
         updated_by = v_actor, updated_at = now()
   where company_id = j.company_id and branch_id = j.branch_id
     and report_date = j.report_date and staff_id = j.staff_id;
end;
$$;

revoke execute on function jornada_cerrar(uuid) from public, anon;
grant execute on function jornada_cerrar(uuid) to authenticated;

-- ------------------------------------------------------------
-- El reporte de cierre
-- ------------------------------------------------------------
-- Lo que el Excel no podía dar: cuánto se trabajó de verdad. Tiempo efectivo
-- es el laborado menos las pausas, y el promedio por llamada sale del detalle
-- de cada evento.
create or replace view v_jornada_resumen
with (security_invoker = true)
as
select
  j.id,
  j.company_id,
  j.branch_id,
  j.staff_id,
  j.report_date,
  j.inicio,
  j.fin,
  j.pausa_tipo,
  j.pausa_inicio,
  j.ultima_marca,
  s.full_name as responsable_nombre,
  (extract(epoch from (coalesce(j.fin, now()) - j.inicio)) * 1000)::bigint as laborado_ms,
  coalesce(p.pausas_ms, 0)                                                 as pausas_ms,
  greatest(0, (extract(epoch from (coalesce(j.fin, now()) - j.inicio)) * 1000)::bigint
              - coalesce(p.pausas_ms, 0))                                  as efectivo_ms,
  coalesce(p.pausas, 0)                                                    as pausas,
  coalesce(l.llamadas, 0)                                                  as llamadas,
  coalesce(l.contestadas, 0)                                               as contestadas,
  coalesce(l.no_contestadas, 0)                                            as no_contestadas,
  coalesce(l.promedio_ms, 0)                                               as promedio_llamada_ms,
  coalesce(a.atenciones, 0)                                                as atenciones
from jornadas j
join staff s on s.id = j.staff_id
left join lateral (
  select count(*) as pausas, sum(duracion_ms)::bigint as pausas_ms
    from jornada_eventos e where e.jornada_id = j.id and e.clase = 'pausa'
) p on true
left join lateral (
  select count(*) as llamadas,
         count(*) filter (where contestada)     as contestadas,
         count(*) filter (where not contestada) as no_contestadas,
         avg(duracion_ms)::bigint               as promedio_ms
    from jornada_eventos e where e.jornada_id = j.id and e.clase = 'llamada'
) l on true
left join lateral (
  select count(*) as atenciones
    from jornada_eventos e where e.jornada_id = j.id and e.clase = 'atencion'
) a on true;

comment on view v_jornada_resumen is
  'Reporte de una jornada: tiempo laborado, efectivo y en pausas, con el conteo de llamadas y atenciones.';
