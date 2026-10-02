-- ============================================================
-- Command Center · 056 · Agendas y validaciones aparte, a nombre de quien toca
--
-- La coordinación (2 de octubre) pidió tres cosas en Mi jornada:
--
--   * Agendas son agendas y validaciones son validaciones. Hasta acá, llamar
--     a un cliente por su cita caía siempre en el bloque de agendas. Ahora hay
--     dos botones y dos juegos de contadores con las mismas cinco respuestas:
--     confirma, posible asistencia, reprograma, no contesta y cancela.
--
--   * La gestión no siempre es de quien llama. Quien valida la agenda de un
--     compañero elige a esa persona antes de tipificar, y el resultado suma
--     en el día de ella, no en el de quien marcó. Solo en estos dos bloques:
--     las demás tipificaciones siguen siendo de quien abrió la jornada.
--
--   * Dos pausas más: incidencias y pausas activas.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Dos pausas más
-- ------------------------------------------------------------
alter table jornadas drop constraint if exists jornadas_pausa_tipo_check;
alter table jornadas add constraint jornadas_pausa_tipo_check
  check (pausa_tipo in ('bano', 'capacitacion', 'almuerzo', 'incidencia', 'pausa_activa'));

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
  if p_tipo not in ('bano', 'capacitacion', 'almuerzo', 'incidencia', 'pausa_activa') then
    raise exception 'Tipo de pausa desconocido: %', p_tipo;
  end if;

  update jornadas set pausa_tipo = p_tipo, pausa_inicio = now(), updated_by = v_actor
   where id = p_jornada;
end;
$$;

-- ------------------------------------------------------------
-- 2. Los contadores de validaciones
-- ------------------------------------------------------------
alter table daily_activity
  add column if not exists validacion_confirmada   int not null default 0 check (validacion_confirmada >= 0),
  add column if not exists validacion_posible      int not null default 0 check (validacion_posible >= 0),
  add column if not exists validacion_reprograma   int not null default 0 check (validacion_reprograma >= 0),
  add column if not exists validacion_no_contesta  int not null default 0 check (validacion_no_contesta >= 0),
  add column if not exists validacion_cancela      int not null default 0 check (validacion_cancela >= 0);

comment on column daily_activity.validacion_confirmada is
  'Validaciones de agenda: llamadas para validar una cita ya agendada. Se cuentan aparte del bloque de agendas.';

-- ------------------------------------------------------------
-- 3. A nombre de quién va la gestión
-- ------------------------------------------------------------
alter table jornada_eventos
  add column if not exists staff_destino uuid references staff (id);

comment on column jornada_eventos.staff_destino is
  'La persona del equipo a la que suma esta gestión cuando no es quien la registró. Solo agendas y validaciones.';

-- ------------------------------------------------------------
-- 4. De la tipificación al contador, con las validaciones
-- ------------------------------------------------------------
create or replace function jornada_columna(
  p_clase text, p_contestada boolean, p_categoria text, p_tipificacion text
)
returns text
language sql
immutable
as $$
  select case
    when p_clase = 'llamada' and not p_contestada then 'llamada_no_contestada'
    when p_clase = 'llamada' and p_categoria = 'comercial' then
      case p_tipificacion
        when 'venta'         then 'llamada_efectiva'
        when 'seguimiento'   then 'llamada_seguimiento'
        when 'agenda'        then 'llamada_agenda'
        when 'no_interesado' then 'llamada_no_interesado'
        when 'postventa'     then 'llamada_postventa'
        -- Agenda: la llamada por una cita ya concertada.
        when 'confirma'      then 'agenda_confirmada'
        when 'posible'       then 'agenda_posible'
        when 'reprograma'    then 'agenda_reprograma'
        when 'no_contesta'   then 'agenda_no_contesta'
        when 'cancela'       then 'agenda_cancela'
        -- Validación: las mismas cinco respuestas, contadas aparte.
        when 'val_confirma'    then 'validacion_confirmada'
        when 'val_posible'     then 'validacion_posible'
        when 'val_reprograma'  then 'validacion_reprograma'
        when 'val_no_contesta' then 'validacion_no_contesta'
        when 'val_cancela'     then 'validacion_cancela'
      end
    when p_clase = 'llamada' and p_categoria = 'administrativa' then
      case p_tipificacion
        when 'asociados'    then 'atencion_asociado'
        when 'enrolamiento' then 'atencion_enrolamiento'
        when 'certificado'  then 'atencion_certificados'
        when 'renovaciones' then 'atencion_renovacion'
      end
    when p_clase = 'atencion' and p_categoria = 'comercial' then
      case p_tipificacion
        when 'venta'         then 'atencion_venta'
        when 'venta_externa' then 'atencion_venta_externa'
        when 'seguimiento'   then 'atencion_seguimiento'
        when 'no_interesado' then 'atencion_declinado'
        when 'agenda'        then 'atencion_agenda'
      end
    when p_clase = 'atencion' and p_categoria = 'administrativa' then
      case p_tipificacion
        when 'asociados'    then 'atencion_asociado'
        when 'enrolamiento' then 'atencion_enrolamiento'
        when 'certificado'  then 'atencion_certificados'
        when 'renovaciones' then 'atencion_renovacion'
      end
  end;
$$;

-- ------------------------------------------------------------
-- 5. Tipificar, ahora con destinatario
-- ------------------------------------------------------------
-- La firma cambia (un parámetro más), así que la vieja se quita: dos
-- funciones con el mismo nombre dejarían a PostgREST sin saber cuál llamar.
drop function if exists jornada_tipificar(uuid, text, boolean, text, text);

create or replace function jornada_tipificar(
  p_jornada      uuid,
  p_clase        text,
  p_contestada   boolean,
  p_categoria    text,
  p_tipificacion text,
  p_destino      uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  j         jornadas;
  v_actor   uuid := auth.uid();
  v_columna text;
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

  v_columna := jornada_columna(p_clase, p_contestada, p_categoria, p_tipificacion);

  -- Una llamada no contestada no se tipifica; todo lo demás sí, y la lista
  -- válida es la que `jornada_columna` sabe contar.
  if not (p_clase = 'llamada' and p_contestada is false) and v_columna is null then
    raise exception 'Esa tipificación no existe para % %', p_clase, coalesce(p_categoria, '');
  end if;

  -- A nombre de otro solo van las agendas y las validaciones, y solo de
  -- alguien que sea del equipo de esta empresa.
  if p_destino is not null and p_destino <> j.staff_id then
    if v_columna is null or v_columna !~ '^(agenda|validacion)_' then
      raise exception 'Solo las agendas y las validaciones se registran a nombre de otra persona';
    end if;
    if not exists (select 1 from company_staff
                    where company_id = j.company_id and staff_id = p_destino) then
      raise exception 'Esa persona no es del equipo de esta empresa';
    end if;
  end if;

  insert into jornada_eventos (jornada_id, company_id, clase, contestada, categoria,
                               tipificacion, inicio, actor, staff_destino)
  values (p_jornada, j.company_id, p_clase,
          case when p_clase = 'llamada' then coalesce(p_contestada, false) else null end,
          p_categoria,
          case when p_clase = 'llamada' and p_contestada is false then null else p_tipificacion end,
          -- Una atención presencial no hereda el tiempo de espera de la
          -- llamada anterior: dura lo que dura la conversación, y mezclarlas
          -- inflaría el promedio por llamada.
          case when p_clase = 'atencion' then now() else j.ultima_marca end,
          v_actor,
          case when p_destino is distinct from j.staff_id then p_destino end);

  update jornadas set ultima_marca = now(), updated_by = v_actor where id = p_jornada;
end;
$$;

revoke all on function jornada_tipificar(uuid, text, boolean, text, text, uuid) from public, anon;
grant execute on function jornada_tipificar(uuid, text, boolean, text, text, uuid) to authenticated, service_role;

-- ------------------------------------------------------------
-- 6. El evento suma en el día de quien corresponde
-- ------------------------------------------------------------
-- Con destinatario, el contador va a la fila de esa persona: en su sede (la
-- del equipo; si no tiene, la de la jornada de quien registró) y en el mismo
-- día. Si esa persona no ha abierto jornada hoy, la fila se crea igual: la
-- validaron aunque no esté.
create or replace function jornada_evento_suma()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_columna text;
  j         jornadas;
  v_staff   uuid;
  v_branch  uuid;
begin
  select * into j from jornadas where id = new.jornada_id;

  v_columna := jornada_columna(new.clase, new.contestada, new.categoria, new.tipificacion);
  if v_columna is null then
    return new;
  end if;

  v_staff  := coalesce(new.staff_destino, j.staff_id);
  v_branch := j.branch_id;
  if new.staff_destino is not null then
    select coalesce(cs.branch_id, j.branch_id) into v_branch
      from company_staff cs
     where cs.company_id = j.company_id and cs.staff_id = new.staff_destino;
    v_branch := coalesce(v_branch, j.branch_id);
  end if;

  perform set_config('app.jornada_sumando', '1', true);

  execute format($f$
    insert into daily_activity (company_id, branch_id, report_date, period_month,
                                staff_id, responsable_nombre, %I,
                                eventos_automaticos, created_by, updated_by)
    values ($1, $2, $3, date_trunc('month', $3::date)::date, $4,
            (select full_name from staff where id = $4), 1, true, $5, $5)
    on conflict (company_id, branch_id, report_date, staff_id)
    do update set %I = daily_activity.%I + 1,
                  eventos_automaticos = true,
                  updated_by = $5, updated_at = now()
  $f$, v_columna, v_columna, v_columna)
  using j.company_id, v_branch, j.report_date, v_staff, new.actor;

  perform set_config('app.jornada_sumando', '0', true);
  return new;
end;
$$;

revoke execute on function jornada_evento_suma() from public, anon, authenticated;

-- ------------------------------------------------------------
-- 7. El formulario tampoco pisa las validaciones contadas
-- ------------------------------------------------------------
create or replace function daily_activity_conservar_calculados()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.jornada_sumando', true), '0') = '1' then
    return new;
  end if;
  if not old.eventos_automaticos then
    return new;
  end if;

  new.agenda_confirmada      := old.agenda_confirmada;
  new.agenda_posible         := old.agenda_posible;
  new.agenda_reprograma      := old.agenda_reprograma;
  new.agenda_no_contesta     := old.agenda_no_contesta;
  new.agenda_cancela         := old.agenda_cancela;
  new.validacion_confirmada  := old.validacion_confirmada;
  new.validacion_posible     := old.validacion_posible;
  new.validacion_reprograma  := old.validacion_reprograma;
  new.validacion_no_contesta := old.validacion_no_contesta;
  new.validacion_cancela     := old.validacion_cancela;
  new.llamada_no_contestada  := old.llamada_no_contestada;
  new.llamada_efectiva       := old.llamada_efectiva;
  new.llamada_seguimiento    := old.llamada_seguimiento;
  new.llamada_agenda         := old.llamada_agenda;
  new.llamada_no_interesado  := old.llamada_no_interesado;
  new.llamada_postventa      := old.llamada_postventa;
  new.llamada_contestada     := old.llamada_contestada;
  new.atencion_venta         := old.atencion_venta;
  new.atencion_venta_externa := old.atencion_venta_externa;
  new.atencion_seguimiento   := old.atencion_seguimiento;
  new.atencion_declinado     := old.atencion_declinado;
  new.atencion_asociado      := old.atencion_asociado;
  new.atencion_enrolamiento  := old.atencion_enrolamiento;
  new.atencion_certificados  := old.atencion_certificados;
  new.atencion_agenda        := old.atencion_agenda;
  new.atencion_renovacion    := old.atencion_renovacion;
  new.eventos_automaticos    := true;
  return new;
end;
$$;

revoke execute on function daily_activity_conservar_calculados() from public, anon, authenticated;

-- ------------------------------------------------------------
-- 8. La vista de gestión diaria enseña las validaciones
-- ------------------------------------------------------------
-- `create or replace view` solo deja añadir columnas al final, y eso es lo
-- que se hace: todo lo anterior queda igual y en el mismo orden.
create or replace view v_daily_activity as
select a.id,
    a.company_id,
    a.branch_id,
    a.report_date,
    a.period_month,
    a.staff_id,
    a.responsable_nombre,
    a.hora_llegada,
    a.hora_salida,
    a.chats_inicial,
    a.chats_medio,
    a.chats_final,
    a.tareas_inicial,
    a.tareas_medio,
    a.tareas_final,
    a.caducadas_inicial,
    a.caducadas_medio,
    a.caducadas_final,
    a.agenda_confirmada,
    a.agenda_posible,
    a.agenda_reprograma,
    a.agenda_no_contesta,
    a.agenda_cancela,
    a.llamada_no_contestada,
    a.llamada_efectiva,
    a.llamada_seguimiento,
    a.llamada_agenda,
    a.llamada_no_interesado,
    a.llamada_contestada,
    a.llamada_postventa,
    a.atencion_venta,
    a.atencion_seguimiento,
    a.atencion_declinado,
    a.atencion_asociado,
    a.atencion_enrolamiento,
    a.atencion_certificados,
    a.atencion_agenda,
    a.atencion_renovacion,
    a.notas,
    a.source,
    a.source_file,
    a.source_row,
    a.created_by,
    a.created_at,
    a.updated_by,
    a.updated_at,
    a.atencion_venta_externa,
    c.hora_entrada,
        case
            when a.hora_llegada is null then null::boolean
            else a.hora_llegada > c.hora_entrada
        end as llego_tarde,
    a.agenda_confirmada + a.agenda_posible + a.agenda_reprograma + a.agenda_no_contesta + a.agenda_cancela as total_agendas,
    a.llamada_efectiva + a.llamada_seguimiento + a.llamada_agenda + a.llamada_no_interesado + a.llamada_postventa as llamadas_contestadas,
    a.llamada_no_contestada + a.llamada_efectiva + a.llamada_seguimiento + a.llamada_agenda + a.llamada_no_interesado + a.llamada_postventa as total_llamadas,
    a.atencion_venta + a.atencion_seguimiento + a.atencion_declinado + a.atencion_venta_externa as total_atencion,
    a.atencion_asociado + a.atencion_enrolamiento + a.atencion_certificados + a.atencion_renovacion as total_administrativa,
    a.chats_inicial - a.chats_final as chats_depurados,
    a.tareas_inicial - a.tareas_final as tareas_depuradas,
    a.caducadas_inicial - a.caducadas_final as caducadas_depuradas,
    safe_ratio(a.llamada_efectiva::numeric, (a.llamada_efectiva + a.llamada_seguimiento + a.llamada_agenda + a.llamada_no_interesado + a.llamada_postventa)::numeric) as volumen_venta_general,
    safe_ratio(a.llamada_efectiva::numeric, (a.llamada_no_contestada + a.llamada_efectiva + a.llamada_seguimiento + a.llamada_agenda + a.llamada_no_interesado + a.llamada_postventa)::numeric) as ratio_conversion_llamada,
    safe_ratio((a.llamada_efectiva + a.llamada_seguimiento + a.llamada_agenda + a.llamada_no_interesado + a.llamada_postventa)::numeric, (a.llamada_no_contestada + a.llamada_efectiva + a.llamada_seguimiento + a.llamada_agenda + a.llamada_no_interesado + a.llamada_postventa)::numeric) as ratio_contactabilidad,
    safe_ratio(a.atencion_agenda::numeric, (a.agenda_confirmada + a.agenda_posible + a.agenda_reprograma + a.agenda_no_contesta + a.agenda_cancela)::numeric) as ratio_conversion_agendas,
    safe_ratio((a.atencion_venta + a.atencion_venta_externa)::numeric, (a.atencion_venta + a.atencion_seguimiento + a.atencion_declinado + a.atencion_venta_externa)::numeric) as ratio_venta_presencial,
    a.eventos_automaticos,
    a.validacion_confirmada,
    a.validacion_posible,
    a.validacion_reprograma,
    a.validacion_no_contesta,
    a.validacion_cancela,
    a.validacion_confirmada + a.validacion_posible + a.validacion_reprograma + a.validacion_no_contesta + a.validacion_cancela as total_validaciones
   from daily_activity a
     join companies c on c.id = a.company_id;

alter view v_daily_activity set (security_invoker = true);
