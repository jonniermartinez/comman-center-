-- ============================================================
-- Command Center · 053 · La inversión en pauta se digita; el ROAS se calcula
--
-- La coordinación pidió (22 de septiembre) medir cuánto rinde la publicidad
-- de cada empresa: ROAS = facturación ÷ inversión en pauta, y costo por
-- venta = inversión ÷ número de ventas. La facturación y las ventas ya salen
-- de la base; la inversión no la conoce nadie más que quien paga la pauta,
-- así que es el único dato que se digita. Lo actualizan cada dos días con el
-- acumulado del mes.
--
-- Una fila por empresa y mes, como los días hábiles (044). Sin fila no hay
-- inversión y los dos indicadores se muestran vacíos, no en cero: un ROAS de
-- cero diría que la pauta no sirvió, cuando lo que pasa es que nadie anotó
-- cuánto se invirtió.
-- ============================================================

create table if not exists company_ad_spend (
  company_id   uuid    not null references companies (id) on delete cascade,
  period_month date    not null,
  monto        numeric not null check (monto >= 0),
  updated_by   uuid references profiles (id),
  updated_at   timestamptz not null default now(),
  primary key (company_id, period_month),
  constraint company_ad_spend_dia_uno
    check (date_trunc('month', period_month)::date = period_month)
);

comment on table company_ad_spend is
  'Pesos invertidos en pauta publicitaria por empresa y mes. Se digita a mano; contra eso se calculan el ROAS y el costo por venta.';

alter table company_ad_spend enable row level security;

create policy company_ad_spend_select on company_ad_spend
  for select using (company_id in (select my_company_ids()));
create policy company_ad_spend_insert on company_ad_spend
  for insert with check (can_manage_company(company_id));
create policy company_ad_spend_update on company_ad_spend
  for update using (can_manage_company(company_id)) with check (can_manage_company(company_id));
create policy company_ad_spend_delete on company_ad_spend
  for delete using (can_manage_company(company_id));
