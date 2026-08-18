-- ============================================================
-- Command Center · 007 · Actividad por usuario
-- Cuántos registros históricos tiene a su nombre cada usuario. Lo usa la
-- pantalla de usuarios para decir exactamente qué se conserva al eliminarlo.
-- ============================================================
create or replace view v_user_activity as
select
  p.id as user_id,
  (select count(*) from daily_kpi        k where k.user_id = p.id) +
  (select count(*) from daily_management d where d.user_id = p.id) +
  (select count(*) from sales_entries    s where s.user_id = p.id) as registros
from profiles p;

alter view v_user_activity set (security_invoker = true);
