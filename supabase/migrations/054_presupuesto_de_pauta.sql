-- ============================================================
-- Command Center · 054 · El presupuesto autorizado va aparte de lo invertido
--
-- La 053 guardó un solo número por empresa y mes: lo invertido en pauta. La
-- coordinación (30 de septiembre) necesita dos: cuánto se autorizó invertir
-- en el mes y cuánto va realmente invertido. Con los dos sale lo que el Excel
-- de cumplimiento calculaba a mano: lo que ya se debía haber gastado, lo que
-- falta por invertir y cuánto facturaría eso al ROAS que lleva el mes.
--
-- El presupuesto se puede anotar el día uno, antes de invertir nada, así que
-- `monto` deja de ser obligatorio. Lo que no puede existir es una fila sin
-- ninguno de los dos datos.
-- ============================================================

alter table company_ad_spend
  add column if not exists presupuesto numeric check (presupuesto >= 0);

alter table company_ad_spend
  alter column monto drop not null;

alter table company_ad_spend
  drop constraint if exists company_ad_spend_algun_dato;
alter table company_ad_spend
  add constraint company_ad_spend_algun_dato
    check (monto is not null or presupuesto is not null);

comment on column company_ad_spend.monto is
  'Lo que va realmente invertido en pauta en el mes (acumulado). Null si solo se anotó el presupuesto.';
comment on column company_ad_spend.presupuesto is
  'Presupuesto de pauta autorizado para el mes. Null si nadie lo anotó.';
