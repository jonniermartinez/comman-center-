-- ============================================================
-- Command Center · 051 · La agenda se gestiona
--
-- 049 y 050 dejaron claro de quién es la cita: nace como una tarea del
-- calendario de Kommo y la aplicación no la escribe. Eso sigue igual. Lo que
-- faltaba es lo otro: qué hizo el comercial con esa cita.
--
-- Una agenda no es una fila muerta con un texto de resultado. Es un ciclo:
-- se llama al cliente para validarla, el cliente confirma o pide otra fecha,
-- llega el día, viene o no viene, y si no vino se le persigue hasta tres
-- veces. Todo eso pasaba en una hoja aparte o en la cabeza de cada quien.
--
-- Por eso la gestión va en tablas propias y no en columnas de `appointments`:
--
--   - `appointments` lo escribe Kommo. Si la aplicación también escribiera
--     ahí, el próximo webhook pisaría lo que puso el comercial.
--   - La gestión la escribe la aplicación, y solo por funciones: no se abren
--     políticas de escritura que después haya que confiar en que nadie use mal.
--
-- Tres automatizaciones vienen con esto:
--
--   1. El estado se deduce del calendario. Nadie tiene que marcar "vencida"
--      ni "no asistió": si llegó el día y no se validó, está vencida; si el
--      día pasó y nadie marcó asistencia, no asistió. Va en una vista, no en
--      un cron: así la respuesta es correcta en el instante en que se pregunta.
--   2. Cada tipificación suma sola en la jornada del día. Las columnas
--      `agenda_*` de `daily_activity` se digitaban a mano; ahora las llena el
--      trigger con lo que de verdad pasó, y los indicadores dejan de depender
--      de que alguien se acuerde.
--   3. Si Kommo mueve la fecha de la tarea, la gestión vuelve a empezar. Es
--      otra cita: validarla otra vez es lo correcto, y arrastrar el
--      "confirmada" de la fecha vieja sería mentira.
-- ============================================================

-- ------------------------------------------------------------
-- El estado de una agenda
-- ------------------------------------------------------------
-- Ocho estados, y solo cinco se escriben. `vencida` y el `no_asistio`
-- automático los calcula la vista contra el calendario; `pendiente` es no
-- haber hecho nada todavía.
create table if not exists appointment_gestion (
  appointment_id      uuid primary key references appointments(id) on delete cascade,
  -- Repetida a propósito: RLS pregunta por la empresa en cada fila y hacerlo
  -- con un join a `appointments` obligaría a leer la otra tabla para decidir
  -- si se puede leer esta.
  company_id          uuid not null references companies(id) on delete cascade,
  estado              text not null default 'pendiente'
                        check (estado in ('pendiente','confirmada','posible','reprogramada',
                                          'cancelada','asistio','no_asistio','descartada')),
  -- En qué terminó la visita. Solo tiene sentido con estado 'asistio'.
  asistencia          text check (asistencia in ('venta','seguimiento','no_interesado')),
  intentos_validacion int  not null default 0,
  -- Llamadas después de que no asistió. Al tercero se descarta sola.
  seguimientos_post   int  not null default 0,
  -- La fecha que pidió el cliente. No se copia a `appointments.scheduled_at`
  -- porque esa la manda Kommo: acá queda anotada hasta que la tarea se mueva
  -- allá, y la pantalla avisa que falta hacerlo.
  reprogramada_para   date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  updated_by          uuid references profiles(id),
  constraint asistencia_solo_si_asistio
    check (asistencia is null or estado = 'asistio')
);

comment on table appointment_gestion is
  'Qué hizo el comercial con una cita de Kommo. Una fila por agenda, escrita solo por las funciones agenda_*.';

drop trigger if exists appointment_gestion_set_updated_at on appointment_gestion;
create trigger appointment_gestion_set_updated_at before update on appointment_gestion
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- El historial
-- ------------------------------------------------------------
-- Cada llamada y cada marca dejan una línea. Sirve para dos cosas: que el que
-- retoma el cliente sepa qué se le dijo, y que el conteo de la jornada tenga
-- de dónde salir (el trigger de más abajo cuelga de acá).
create table if not exists appointment_eventos (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments(id) on delete cascade,
  company_id     uuid not null references companies(id) on delete cascade,
  tipo           text not null
                   check (tipo in ('no_contesta','confirma','posible','reprograma','cancela',
                                   'asistio','no_asistio','descartada','movida_en_kommo')),
  detalle        text,
  -- Quién lo hizo, con el nombre congelado: el perfil se puede borrar y el
  -- historial tiene que seguir diciendo quién llamó.
  actor          uuid references profiles(id),
  actor_nombre   text,
  ocurrido_en    timestamptz not null default now()
);

comment on table appointment_eventos is
  'Historial de una agenda: cada llamada de validación y cada marca de asistencia.';

create index if not exists appointment_eventos_agenda_idx
  on appointment_eventos (appointment_id, ocurrido_en desc);
create index if not exists appointment_gestion_company_estado_idx
  on appointment_gestion (company_id, estado);

-- ------------------------------------------------------------
-- Quién puede gestionar una agenda
-- ------------------------------------------------------------
-- El responsable de la cita, y quien coordina la empresa. Una agenda sin
-- responsable —la tarea de Kommo es de un usuario que nadie enlazó todavía—
-- la puede trabajar cualquiera de la empresa: alguien tiene que llamar a ese
-- cliente, y dejarla bloqueada hasta que se arregle el mapeo sería peor.
create or replace function puede_gestionar_agenda(p_agenda uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from appointments a
     where a.id = p_agenda
       and (
         can_manage_company(a.company_id)
         or (a.company_id in (select my_company_ids())
             and (a.staff_id is null or es_mi_registro(a.staff_id)))
       )
  );
$$;

revoke execute on function puede_gestionar_agenda(uuid) from public, anon;
grant execute on function puede_gestionar_agenda(uuid) to authenticated;

-- ------------------------------------------------------------
-- RLS: se lee, no se escribe
-- ------------------------------------------------------------
alter table appointment_gestion  enable row level security;
alter table appointment_eventos  enable row level security;

drop policy if exists appointment_gestion_select on appointment_gestion;
create policy appointment_gestion_select on appointment_gestion
  for select using (company_id in (select my_company_ids()));

drop policy if exists appointment_eventos_select on appointment_eventos;
create policy appointment_eventos_select on appointment_eventos
  for select using (company_id in (select my_company_ids()));

-- Sin políticas de insert/update/delete a propósito: lo único que escribe son
-- las funciones `agenda_*`, que validan el permiso y dejan historial. Un
-- `update` suelto desde el cliente podría cambiar el estado sin que quede
-- rastro de quién ni por qué.

-- ------------------------------------------------------------
-- Automatización 1 · El calendario decide el estado
-- ------------------------------------------------------------
-- El estado que se escribió es una opinión de un momento; el calendario es un
-- hecho. Mientras la cita no esté cerrada, el hecho manda:
--
--   - llegó su día y nadie la validó  → vencida (hay que llamar hoy)
--   - el día ya pasó y nadie marcó    → no asistió
--
-- Cerrada quiere decir que alguien ya dijo en qué terminó —asistió, no
-- asistió, canceló, se descartó—: eso no lo revive ninguna fecha.
create or replace view v_agendas
with (security_invoker = true)
as
with base as (
  select
    a.id, a.company_id, a.branch_id, a.scheduled_at, a.scheduled_time,
    a.staff_id, a.responsable_nombre, a.nombre, a.celular, a.observacion,
    a.resultado, a.source, a.external_lead_id, a.external_url,
    coalesce(g.estado, 'pendiente')    as estado,
    g.asistencia,
    coalesce(g.intentos_validacion, 0) as intentos_validacion,
    coalesce(g.seguimientos_post, 0)   as seguimientos_post,
    g.reprogramada_para,
    g.updated_at                       as gestionada_en,
    (now() at time zone 'America/Bogota')::date as hoy
  from appointments a
  left join appointment_gestion g on g.appointment_id = a.id
)
select
  b.*,
  case
    -- Alguien ya dijo en qué terminó. Ninguna fecha revive eso.
    when b.estado in ('asistio','no_asistio','cancelada','descartada')
      then b.estado
    -- Nunca se gestionó acá, pero el origen ya trajo el resultado: las del
    -- Excel vienen así. Está cerrada; no hay a quién llamar.
    when b.estado = 'pendiente' and b.resultado is not null
      then 'cerrada'
    -- El cliente pidió otra fecha y todavía no llega: la cita sigue viva, lo
    -- que falta es mover la tarea en Kommo.
    when b.estado = 'reprogramada' and b.reprogramada_para >= b.hoy
      then 'reprogramada'
    when b.scheduled_at < b.hoy
      then 'no_asistio'
    when b.scheduled_at = b.hoy and b.estado in ('pendiente','reprogramada')
      then 'vencida'
    else b.estado
  end as estado_efectivo,
  -- El orden de la cola del día. Lo más urgente es la cita de hoy que nadie
  -- validó: si no se llama ahora, ya no se llama.
  --
  -- El seguimiento posterior se corta a los 30 días. A quien no vino hace seis
  -- meses no se le llama hoy, y una cola con el histórico entero adentro no es
  -- una cola: es una lista que nadie abre.
  case
    when b.estado in ('asistio','cancelada','descartada')                         then 9
    when b.estado = 'pendiente' and b.resultado is not null                       then 9
    when b.estado = 'reprogramada' and b.reprogramada_para >= b.hoy               then 3
    when b.scheduled_at = b.hoy and b.estado in ('pendiente','reprogramada')      then 1
    when b.scheduled_at = b.hoy and b.estado in ('confirmada','posible')          then 2
    when b.scheduled_at > b.hoy
         and b.estado in ('pendiente','reprogramada','posible')                   then 4
    when (b.estado = 'no_asistio' or b.scheduled_at < b.hoy)
         and b.seguimientos_post < 3
         and b.scheduled_at >= b.hoy - 30                                         then 5
    else 9
  end as prioridad
from base b;

comment on view v_agendas is
  'Agendas con su gestión y el estado que se deduce del calendario. `prioridad` 1-5 es la cola de trabajo; 9 es lo que ya no pide nada.';

-- ------------------------------------------------------------
-- Automatización 2 · La tipificación suma sola en la jornada
-- ------------------------------------------------------------
-- Las cinco columnas `agenda_*` de `daily_activity` se digitaban al cierre del
-- día, de memoria. Ahora las escribe esto, con lo que de verdad se tipificó.
--
-- Suma en la jornada de quien llamó, no en la del responsable de la cita: la
-- jornada mide el trabajo de una persona en un día, y quien hizo la llamada es
-- quien la trabajó. Si quien llama no está enlazado a una persona del equipo
-- no hay jornada donde sumar, y el evento se guarda igual: perder el historial
-- por un mapeo incompleto sería peor que no tener el contador.
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
    when 'confirma'   then 'agenda_confirmada'
    when 'posible'    then 'agenda_posible'
    when 'reprograma' then 'agenda_reprograma'
    when 'no_contesta' then 'agenda_no_contesta'
    when 'cancela'    then 'agenda_cancela'
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

  execute format($f$
    insert into daily_activity (company_id, branch_id, report_date, period_month,
                                staff_id, responsable_nombre, %I, created_by, updated_by)
    values ($1, $2, $3, date_trunc('month', $3::date)::date, $4, $5, 1, $6, $6)
    on conflict (company_id, branch_id, report_date, staff_id)
    do update set %I = daily_activity.%I + 1, updated_by = $6, updated_at = now()
  $f$, v_columna, v_columna, v_columna)
  using new.company_id, v_branch, v_fecha, v_staff, v_nombre, new.actor;

  return new;
end;
$$;

revoke execute on function agenda_sumar_a_jornada() from public, anon, authenticated;

drop trigger if exists appointment_eventos_suman_jornada on appointment_eventos;
create trigger appointment_eventos_suman_jornada
  after insert on appointment_eventos
  for each row execute function agenda_sumar_a_jornada();

-- ------------------------------------------------------------
-- Automatización 3 · Si Kommo mueve la fecha, se valida otra vez
-- ------------------------------------------------------------
-- La tarea cambió de día en el calendario: es otra cita. Arrastrar el
-- "confirmada" de la fecha anterior diría que el cliente confirmó un día al
-- que nunca se le invitó. Los seguimientos posteriores sí se conservan: son
-- del cliente, no de la fecha.
create or replace function agenda_reiniciar_si_se_mueve()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.scheduled_at is not distinct from old.scheduled_at then
    return new;
  end if;

  update appointment_gestion
     set estado = 'pendiente', asistencia = null,
         intentos_validacion = 0, reprogramada_para = null
   where appointment_id = new.id
     and estado not in ('asistio','descartada');

  if found then
    insert into appointment_eventos (appointment_id, company_id, tipo, detalle)
    values (new.id, new.company_id, 'movida_en_kommo',
            'Kommo la movió al ' || to_char(new.scheduled_at, 'DD/MM/YYYY') || '. Hay que validarla otra vez.');
  end if;

  return new;
end;
$$;

revoke execute on function agenda_reiniciar_si_se_mueve() from public, anon, authenticated;

drop trigger if exists appointments_mover_reinicia_gestion on appointments;
create trigger appointments_mover_reinicia_gestion
  after update of scheduled_at on appointments
  for each row execute function agenda_reiniciar_si_se_mueve();

-- ------------------------------------------------------------
-- Escribir la gestión · llamada de validación
-- ------------------------------------------------------------
-- Una sola puerta para las cinco tipificaciones. Deja el estado, sube el
-- contador de intentos, escribe el historial —y el historial, por el trigger
-- de arriba, suma en la jornada—.
--
-- El tope de tres seguimientos vive acá: a un cliente que no asistió se le
-- insiste tres veces y ya. La cuarta no la bloquea una pantalla, la bloquea
-- esto, que es lo que de verdad se puede sostener.
create or replace function agenda_llamada(
  p_agenda    uuid,
  p_resultado text,
  p_fecha     date default null,
  p_nota      text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a        appointments;
  g        appointment_gestion;
  v_nuevo  text;
  v_actor  uuid := auth.uid();
  v_nombre text;
  v_post   boolean;
begin
  if p_resultado not in ('no_contesta','confirma','posible','reprograma','cancela') then
    raise exception 'Resultado de llamada desconocido: %', p_resultado;
  end if;
  if not puede_gestionar_agenda(p_agenda) then
    raise exception 'Esta agenda no es tuya y no coordinas esta empresa';
  end if;
  if p_resultado = 'reprograma' and p_fecha is null then
    raise exception 'Para reprogramar hay que decir para cuándo';
  end if;

  select * into a from appointments where id = p_agenda;
  if not found then
    raise exception 'Esa agenda no existe';
  end if;

  insert into appointment_gestion (appointment_id, company_id)
  values (p_agenda, a.company_id)
  on conflict (appointment_id) do nothing;

  select * into g from appointment_gestion where appointment_id = p_agenda;

  -- Una llamada después de que no vino es seguimiento, no validación. Cuenta
  -- también el "no asistió" que nadie marcó y que deduce la vista: para el
  -- cliente es lo mismo —el día pasó y no vino—, y hacer que el tope de tres
  -- dependa de si alguien alcanzó a marcarlo sería regalar insistencias.
  v_post := g.estado = 'no_asistio'
            or (a.scheduled_at < (now() at time zone 'America/Bogota')::date
                and g.estado not in ('asistio','cancelada','descartada'));

  if v_post then
    if g.seguimientos_post >= 3 then
      raise exception 'Ya se le insistió tres veces a este cliente: descártalo o déjalo quieto';
    end if;
    -- El día ya pasó: confirmar o dejar en posible una cita que no existe no
    -- dice nada. Lo que queda es una fecha nueva, o soltar al cliente.
    if p_resultado in ('confirma','posible') then
      raise exception 'Esa cita ya pasó. Reprográmala con una fecha nueva o ciérrala.';
    end if;
  end if;

  v_nuevo := case p_resultado
    when 'confirma'   then 'confirmada'
    when 'posible'    then 'posible'
    when 'reprograma' then 'reprogramada'
    when 'cancela'    then 'cancelada'
    else g.estado                      -- no contestó: la agenda sigue donde estaba
  end;

  select full_name into v_nombre from profiles where id = v_actor;

  update appointment_gestion
     set estado              = v_nuevo,
         intentos_validacion = intentos_validacion + 1,
         seguimientos_post   = seguimientos_post + case when v_post then 1 else 0 end,
         reprogramada_para   = case when p_resultado = 'reprograma' then p_fecha
                                    else reprogramada_para end,
         updated_by          = v_actor
   where appointment_id = p_agenda;

  insert into appointment_eventos (appointment_id, company_id, tipo, detalle, actor, actor_nombre)
  values (p_agenda, a.company_id, p_resultado,
          case when p_resultado = 'reprograma'
               then coalesce(nullif(trim(p_nota), '') || ' · ', '')
                    || 'Pidió el ' || to_char(p_fecha, 'DD/MM/YYYY')
               else nullif(trim(p_nota), '') end,
          v_actor, v_nombre);
end;
$$;

revoke execute on function agenda_llamada(uuid, text, date, text) from public, anon;
grant execute on function agenda_llamada(uuid, text, date, text) to authenticated;

-- ------------------------------------------------------------
-- Escribir la gestión · llegó el día
-- ------------------------------------------------------------
-- Vino y en qué terminó, no vino, o se deja de perseguir.
create or replace function agenda_asistencia(
  p_agenda    uuid,
  p_resultado text,
  p_nota      text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a        appointments;
  v_actor  uuid := auth.uid();
  v_nombre text;
begin
  if p_resultado not in ('venta','seguimiento','no_interesado','no_asistio','descartada') then
    raise exception 'Resultado de asistencia desconocido: %', p_resultado;
  end if;
  if not puede_gestionar_agenda(p_agenda) then
    raise exception 'Esta agenda no es tuya y no coordinas esta empresa';
  end if;

  select * into a from appointments where id = p_agenda;
  if not found then
    raise exception 'Esa agenda no existe';
  end if;

  select full_name into v_nombre from profiles where id = v_actor;

  insert into appointment_gestion (appointment_id, company_id)
  values (p_agenda, a.company_id)
  on conflict (appointment_id) do nothing;

  update appointment_gestion
     set estado     = case p_resultado
                        when 'no_asistio'  then 'no_asistio'
                        when 'descartada'  then 'descartada'
                        else 'asistio'
                      end,
         asistencia = case when p_resultado in ('venta','seguimiento','no_interesado')
                           then p_resultado else null end,
         updated_by = v_actor
   where appointment_id = p_agenda;

  insert into appointment_eventos (appointment_id, company_id, tipo, detalle, actor, actor_nombre)
  values (p_agenda, a.company_id,
          case p_resultado
            when 'no_asistio' then 'no_asistio'
            when 'descartada' then 'descartada'
            else 'asistio'
          end,
          case when p_resultado in ('venta','seguimiento','no_interesado')
               then coalesce(nullif(trim(p_nota), '') || ' · ', '')
                    || case p_resultado
                         when 'venta'         then 'Terminó en venta'
                         when 'seguimiento'   then 'Queda en seguimiento'
                         else 'No le interesó'
                       end
               else nullif(trim(p_nota), '') end,
          v_actor, v_nombre);
end;
$$;

revoke execute on function agenda_asistencia(uuid, text, text) from public, anon;
grant execute on function agenda_asistencia(uuid, text, text) to authenticated;

-- ------------------------------------------------------------
-- El mensaje del recordatorio
-- ------------------------------------------------------------
-- Cada empresa habla como habla. El texto se guarda con marcas que la pantalla
-- reemplaza: {cliente}, {fecha}, {hora}, {empresa}.
alter table companies add column if not exists agenda_recordatorio text;
comment on column companies.agenda_recordatorio is
  'Plantilla del recordatorio de WhatsApp. Marcas: {cliente}, {fecha}, {hora}, {empresa}.';
