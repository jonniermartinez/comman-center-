-- ============================================================
-- A la jornada le faltaba su politica de borrado.
--
-- La 012 le dio SELECT, INSERT, UPDATE y DELETE a sales, payments,
-- cash_movements y appointments. La 013 anadio daily_activity despues y le puso
-- las tres primeras, pero no la cuarta. No hay ninguna nota que diga que fuera
-- a proposito: es un olvido.
--
-- Y se nota en el uso. `daily_activity` tiene unica (empresa, sede, fecha,
-- persona): una jornada por persona y dia. Si alguien registra la jornada de
-- Fulano en el dia equivocado, no puede borrarla —nadie puede, ni el super
-- admin— y tampoco puede registrar la buena, porque la clave ya esta ocupada.
-- Queda a merced de editar la fila mal puesta.
--
-- Se le da la misma regla que a las demas: la borra quien administra la
-- empresa.
-- ============================================================
create policy daily_activity_delete on daily_activity
  for delete using (can_manage_company(company_id));
