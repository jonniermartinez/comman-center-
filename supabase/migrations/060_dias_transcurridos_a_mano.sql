-- ============================================================
-- Command Center · 060 · Los días transcurridos también se fijan a mano
--
-- La proyección de Objetivos es real ÷ días hábiles transcurridos × días del
-- mes, y los dos números salían del calendario: lunes a sábado, hasta hoy. La
-- operación (5 de octubre) lo dijo con un ejemplo: el calendario contaba 4
-- días y en realidad se habían trabajado 2. Con el divisor mal, la
-- proyección sale a la mitad.
--
-- Los días del mes ya se podían fijar por empresa (044); ahora también los
-- transcurridos, en la misma fila. Cualquiera de los dos vacío vuelve a la
-- cuenta del calendario, así que `dias` deja de ser obligatorio: se puede
-- corregir solo lo transcurrido.
--
-- Lo que esto cuesta: un número puesto a mano no avanza solo. Mientras esté
-- fijado, mañana sigue diciendo lo mismo hasta que alguien lo cambie o lo
-- borre.
-- ============================================================
alter table company_business_days
  alter column dias drop not null,
  add column if not exists transcurridos int check (transcurridos between 0 and 31);

comment on column company_business_days.dias is
  'Días hábiles del mes fijados a mano. Null = lunes a sábado según el calendario.';
comment on column company_business_days.transcurridos is
  'Días hábiles ya trabajados del mes, fijados a mano para la proyección. Null = se cuentan del calendario hasta hoy. No avanza solo.';
