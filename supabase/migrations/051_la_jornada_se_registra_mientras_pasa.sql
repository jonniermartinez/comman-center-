-- ============================================================
-- Command Center · 051 · La jornada se registra mientras pasa
--
-- `daily_activity` tiene treinta contadores y hasta hoy todos se digitaban a
-- mano, de memoria, al final del día: cuántas llamadas contestaste, cuántas
-- terminaron en venta, cuántas atenciones presenciales. Nadie se acuerda de
-- eso a las seis de la tarde, así que el número que se escribe es el que
-- parece razonable, no el que pasó.
--
-- Esto no cambia qué se mide. Cambia cuándo: el comercial tipifica la llamada
-- al colgar —dos toques— y los treinta contadores se llenan solos.
--
--   `jornadas`        el turno: cuándo abrió, si hay una pausa corriendo y
--                     desde cuándo corre la llamada actual.
--   `jornada_eventos` una fila por llamada, atención y pausa, con su hora y
--                     su duración. Es el detalle que el Excel nunca tuvo.
--   `daily_activity`  sigue siendo el resumen del día, ahora escrito por un
--                     trigger en vez de por la memoria de alguien.
--
-- El formulario de las treinta casillas no se va: sirve para corregir un día,
-- para quien no usó la aplicación y para el histórico cargado del Excel. Lo
-- que sí hace falta es que no se pisen, y de eso se encarga el guardián del
-- final.
-- ============================================================

-- ------------------------------------------------------------
-- El turno
-- ------------------------------------------------------------
-- Una por persona y día, con la misma llave que `daily_activity`: son la
-- misma unidad —un día de trabajo de alguien— vista por sus dos lados.
create table if not exists jornadas (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  branch_id    uuid not null references branches(id),
  staff_id     uuid not null references staff(id),
  report_date  date not null,
  inicio       timestamptz not null default now(),
  fin          timestamptz,
  -- Desde cuándo corre la llamada que se está atendiendo. Cada tipificación
  -- lo mueve a ahora: así la duración de una llamada es el hueco entre la
  -- anterior y esta, sin pedirle a nadie que arranque un cronómetro.
  ultima_marca timestamptz not null default now(),
  -- La pausa en curso, si la hay. Va acá y no en una tabla aparte porque solo
  -- puede haber una: tenerla como fila suelta permitiría dos abiertas.
  pausa_tipo   text check (pausa_tipo in ('bano','capacitacion','almuerzo')),
  pausa_inicio timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references profiles(id),
  unique (company_id, branch_id, report_date, staff_id),
  constraint pausa_completa check ((pausa_tipo is null) = (pausa_inicio is null))
);

comment on table jornadas is
  'El turno de una persona en un día: cuándo abrió, la pausa en curso y desde cuándo corre la llamada actual.';

drop trigger if exists jornadas_set_updated_at on jornadas;
create trigger jornadas_set_updated_at before update on jornadas
  for each row execute function set_updated_at();

create index if not exists jornadas_abiertas_idx
  on jornadas (company_id, staff_id) where fin is null;

-- ------------------------------------------------------------
-- Lo que pasó, una fila cada vez
-- ------------------------------------------------------------
-- La tipificación no se valida con un CHECK contra una lista cerrada: la
-- valida `jornada_columna()`, que es la que sabe en qué contador cae cada
-- una. Una lista repetida en dos sitios es una lista que se desincroniza.
create table if not exists jornada_eventos (
  id           uuid primary key default gen_random_uuid(),
  jornada_id   uuid not null references jornadas(id) on delete cascade,
  company_id   uuid not null references companies(id) on delete cascade,
  clase        text not null check (clase in ('llamada','atencion','pausa')),
  -- Solo para las llamadas. Una atención o una pausa no se contestan.
  contestada   boolean,
  tipificacion text,
  categoria    text check (categoria in ('comercial','administrativa')),
  inicio       timestamptz not null,
  fin          timestamptz not null default now(),
  -- Calculada y guardada: el reporte la suma y la promedia muchas veces, y
  -- recalcularla en cada consulta es trabajo que ya está hecho.
  duracion_ms  integer generated always as
                 (greatest(0, (extract(epoch from (fin - inicio)) * 1000)::integer)) stored,
  actor        uuid references profiles(id),
  created_at   timestamptz not null default now(),
  constraint contestada_solo_en_llamadas
    check ((clase = 'llamada') = (contestada is not null))
);

comment on table jornada_eventos is
  'Cada llamada, atención y pausa de una jornada, con su hora y su duración. De acá salen los contadores de daily_activity.';

create index if not exists jornada_eventos_jornada_idx
  on jornada_eventos (jornada_id, fin desc);

-- ------------------------------------------------------------
-- Se lee, no se escribe
-- ------------------------------------------------------------
alter table jornadas        enable row level security;
alter table jornada_eventos enable row level security;

drop policy if exists jornadas_select on jornadas;
create policy jornadas_select on jornadas
  for select using (company_id in (select my_company_ids()));

drop policy if exists jornada_eventos_select on jornada_eventos;
create policy jornada_eventos_select on jornada_eventos
  for select using (company_id in (select my_company_ids()));

-- Sin políticas de escritura: todo entra por las funciones `jornada_*`, que
-- comprueban el permiso y mantienen a la vez el evento, la marca de tiempo y
-- el contador del resumen. Un insert suelto dejaría las tres cosas a medias.

-- ------------------------------------------------------------
-- De una tipificación a su contador
-- ------------------------------------------------------------
-- El único sitio donde vive el mapeo. Devuelve null si la combinación no
-- existe, y por eso sirve también de validación: lo que no cae en un contador
-- no es una tipificación válida.
--
-- Las llamadas administrativas caen en los mismos contadores `atencion_*` que
-- la atención presencial administrativa. En el Excel esa distinción no
-- existía —son gestiones administrativas y punto—; el detalle de si fue por
-- teléfono o en el mostrador queda en `jornada_eventos`, que es donde se
-- puede mirar sin romper el resumen de siempre.
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
        -- Validar una agenda ya concertada: cuenta en el bloque de agendas.
        when 'confirma'      then 'agenda_confirmada'
        when 'posible'       then 'agenda_posible'
        when 'reprograma'    then 'agenda_reprograma'
        when 'no_contesta'   then 'agenda_no_contesta'
        when 'cancela'       then 'agenda_cancela'
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
-- El evento suma en el resumen del día
-- ------------------------------------------------------------
-- Las pausas no tienen contador en `daily_activity` —el Excel no las medía—,
-- así que se guardan como evento y no suman en ningún lado. El tiempo de
-- pausa sale del propio evento cuando alguien lo pide.
create or replace function jornada_evento_suma()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_columna text;
  j         jornadas;
begin
  select * into j from jornadas where id = new.jornada_id;

  v_columna := jornada_columna(new.clase, new.contestada, new.categoria, new.tipificacion);
  if v_columna is null then
    return new;
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
  using j.company_id, j.branch_id, j.report_date, j.staff_id, new.actor;

  perform set_config('app.jornada_sumando', '0', true);
  return new;
end;
$$;

revoke execute on function jornada_evento_suma() from public, anon, authenticated;

drop trigger if exists jornada_eventos_suman on jornada_eventos;
create trigger jornada_eventos_suman
  after insert on jornada_eventos
  for each row execute function jornada_evento_suma();

-- ------------------------------------------------------------
-- El guardián: el formulario no pisa lo que se contó solo
-- ------------------------------------------------------------
-- El formulario de Gestión Diaria manda la jornada entera de una vez con un
-- `upsert`. Sin esto, cerrar el día por la tarde borraría lo que se tipificó
-- por la mañana y lo cambiaría por lo que alguien recuerde, que es justo lo
-- que se está intentando dejar atrás.
--
-- No falla ni avisa: rechazar el guardado entero por unos contadores que ni
-- siquiera se editaron perdería la hora de salida y las notas. Se conservan
-- los calculados y se guarda lo demás. En pantalla salen apagados, para que
-- nadie escriba un número que no se va a guardar.
alter table daily_activity
  add column if not exists eventos_automaticos boolean not null default false;

comment on column daily_activity.eventos_automaticos is
  'Los contadores de esta fila los escribieron los eventos de la jornada. El formulario no los toca.';

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

drop trigger if exists daily_activity_conservar_calculados on daily_activity;
create trigger daily_activity_conservar_calculados
  before update on daily_activity
  for each row execute function daily_activity_conservar_calculados();

-- ------------------------------------------------------------
-- Que la pantalla pueda saberlo
-- ------------------------------------------------------------
-- El formulario de Gestión Diaria lee `v_daily_activity`. Con la marca ahí,
-- puede enseñar apagados los contadores que ya se contaron solos y explicar
-- por qué, en vez de aceptar una edición que después no aparece.
--
-- La columna se agrega al final: `create or replace view` no deja reordenar
-- las que ya existen, y borrarla para recrearla arrastraría las tres vistas
-- que cuelgan de esta. La cirugía sobre el texto de la definición evita
-- repetir acá las sesenta columnas de 044.
do $$
declare
  def text;
begin
  select pg_get_viewdef('public.v_daily_activity'::regclass, true) into def;
  if def like '%eventos_automaticos%' then
    return;
  end if;
  def := replace(def, '   FROM daily_activity a', ',
    a.eventos_automaticos
   FROM daily_activity a');
  execute 'create or replace view v_daily_activity with (security_invoker = true) as ' || def;
end $$;
