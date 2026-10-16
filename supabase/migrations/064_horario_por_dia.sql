-- ============================================================
-- Command Center · 064 · El horario de cada comercial cambia por día
--
-- Con la 058 cada comercial tiene su hora de entrada y de salida, pero una
-- sola para toda la semana. La operación (14 de octubre) lo dijo claro:
-- unos entran a una hora de lunes a miércoles, a otra jueves y viernes, y el
-- sábado salen al mediodía. Cada día puede tener una hora distinta.
--
-- Cada día va en su propia fila. Lo que no tenga fila sigue con lo de antes:
-- la hora de la persona (058) y, si tampoco tiene, la de la empresa. Así que
-- nadie cambia de horario por esta migración: hasta que alguien llene un día,
-- la vista calcula exactamente lo mismo.
-- ============================================================
create table if not exists company_staff_horarios (
  company_id   uuid     not null,
  staff_id     uuid     not null,
  -- ISO: 1 = lunes … 7 = domingo, como `extract(isodow …)`.
  dia          smallint not null check (dia between 1 and 7),
  hora_entrada time,
  hora_salida  time,
  primary key (company_id, staff_id, dia),
  foreign key (company_id, staff_id)
    references company_staff (company_id, staff_id) on delete cascade
);

comment on table company_staff_horarios is
  'Horario de una persona en una empresa para un día de la semana. Lo que falte sale de company_staff y luego de companies.';
comment on column company_staff_horarios.dia is
  '1 = lunes … 7 = domingo (isodow).';

alter table company_staff_horarios enable row level security;

-- Las mismas reglas que company_staff: lo ve quien tiene acceso a la
-- empresa y lo cambia quien la gestiona.
create policy company_staff_horarios_select on company_staff_horarios
  for select using (company_id in (select my_company_ids()));

create policy company_staff_horarios_write on company_staff_horarios
  for all using (can_manage_company(company_id))
  with check (can_manage_company(company_id));

grant select, insert, update, delete on company_staff_horarios to authenticated;

-- La vista de gestión diaria mide la tardanza contra la hora del día de la
-- jornada. Las columnas no cambian de nombre ni de orden: solo se antepone
-- la hora del día a la cadena que dejó la 058.
do $$
declare d text;
begin
  d := pg_get_viewdef('v_daily_activity'::regclass, true);
  if d not like '%company_staff_horarios%' then
    d := replace(d, 'COALESCE(cs.hora_entrada, c.hora_entrada)',
                    'COALESCE(hd.hora_entrada, cs.hora_entrada, c.hora_entrada)');
    d := replace(d, 'LEFT JOIN company_staff cs ON cs.company_id = a.company_id AND cs.staff_id = a.staff_id',
                    'LEFT JOIN company_staff cs ON cs.company_id = a.company_id AND cs.staff_id = a.staff_id'
                    || ' LEFT JOIN company_staff_horarios hd ON hd.company_id = a.company_id AND hd.staff_id = a.staff_id'
                    || ' AND hd.dia = EXTRACT(isodow FROM a.report_date)::smallint');
    if d like '%COALESCE(cs.hora_entrada, c.hora_entrada)%' or d not like '%LEFT JOIN company_staff_horarios%' then
      raise exception 'La vista v_daily_activity no tiene la forma esperada';
    end if;
    execute 'create or replace view v_daily_activity as ' || d;
    execute 'alter view v_daily_activity set (security_invoker = true)';
  end if;
end $$;
