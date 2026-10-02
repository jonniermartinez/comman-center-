-- ============================================================
-- Command Center · 058 · Cada comercial tiene su horario
--
-- La hora de entrada era una sola por empresa (08:00), y contra ella se
-- decidía si alguien llegó tarde. La operación (2 de octubre) lo dijo claro:
-- no todos entran a las ocho, cada comercial tiene su hora de ingreso y de
-- salida, y editarle la llegada no sirve si el sistema lo sigue midiendo
-- contra las ocho.
--
-- El horario va en `company_staff`, que es donde vive la relación de una
-- persona con una empresa. Vacío significa "el de la empresa", así que nadie
-- cambia de horario por esta migración.
--
-- De paso, la atención presencial también puede ir a nombre de otra persona
-- del equipo, como las agendas y las validaciones (056).
-- ============================================================
alter table company_staff
  add column if not exists hora_entrada time,
  add column if not exists hora_salida  time;

comment on column company_staff.hora_entrada is
  'Hora a la que se espera a esta persona en esta empresa. Null = la de la empresa. Contra ella se decide si llegó tarde.';
comment on column company_staff.hora_salida is
  'Hora a la que termina el turno de esta persona. Informativa.';

-- La vista de gestión diaria mide la tardanza contra el horario de la
-- persona. Las columnas no cambian de nombre ni de orden: solo cambia de
-- dónde sale la hora esperada, y por eso se reescribe la definición vigente
-- en vez de copiarla entera otra vez.
do $$
declare d text;
begin
  d := pg_get_viewdef('v_daily_activity'::regclass, true);
  if d not like '%company_staff%' then
    d := replace(d, 'c.hora_entrada,', 'COALESCE(cs.hora_entrada, c.hora_entrada) AS hora_entrada,');
    d := replace(d, 'a.hora_llegada > c.hora_entrada', 'a.hora_llegada > COALESCE(cs.hora_entrada, c.hora_entrada)');
    d := replace(d, 'JOIN companies c ON c.id = a.company_id',
                    'JOIN companies c ON c.id = a.company_id LEFT JOIN company_staff cs ON cs.company_id = a.company_id AND cs.staff_id = a.staff_id');
    if d like '%c.hora_entrada,%' or d not like '%LEFT JOIN company_staff%' then
      raise exception 'La vista v_daily_activity no tiene la forma esperada';
    end if;
    execute 'create or replace view v_daily_activity as ' || d;
    execute 'alter view v_daily_activity set (security_invoker = true)';
  end if;
end $$;

-- A nombre de otra persona: agendas, validaciones y, desde ahora, atenciones.
do $$
declare f text;
begin
  select pg_get_functiondef(p.oid) into f from pg_proc p where p.proname = 'jornada_tipificar';
  if f like '%^(agenda|validacion)_%' then
    f := replace(f, '^(agenda|validacion)_', '^(agenda|validacion|atencion)_');
    f := replace(f, 'Solo las agendas y las validaciones se registran a nombre de otra persona',
                    'Solo las agendas, las validaciones y las atenciones se registran a nombre de otra persona');
    execute f;
  end if;
end $$;
