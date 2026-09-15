-- ============================================================
-- Command Center · 045 · Las metas de los indicadores son de cada empresa
--
-- Las metas del tablero de indicadores (70 % de contactabilidad, 45 llamadas
-- contestadas al día, etc.) estaban escritas en el código porque la gerencia
-- las dio como regla general. En la revisión del 15 de septiembre pidieron
-- poder cambiarlas: son las actuales, pero cada empresa puede tener las suyas.
--
-- Una fila por empresa e indicador. Sin fila, rige la meta por defecto del
-- código; borrar la fila es volver a ella. Los ratios se guardan en fracción
-- (0,7 = 70 %) y las cantidades tal cual (45 llamadas).
-- ============================================================

create table if not exists company_kpi_targets (
  company_id uuid    not null references companies (id) on delete cascade,
  kpi_code   text    not null,
  meta       numeric not null check (meta > 0),
  updated_by uuid references profiles (id),
  updated_at timestamptz not null default now(),
  primary key (company_id, kpi_code)
);

comment on table company_kpi_targets is
  'Meta de cada indicador del tablero por empresa. Sin fila rige la meta por defecto de la aplicación. Ratios en fracción, cantidades tal cual.';

alter table company_kpi_targets enable row level security;

create policy company_kpi_targets_select on company_kpi_targets
  for select using (company_id in (select my_company_ids()));
create policy company_kpi_targets_insert on company_kpi_targets
  for insert with check (can_manage_company(company_id));
create policy company_kpi_targets_update on company_kpi_targets
  for update using (can_manage_company(company_id)) with check (can_manage_company(company_id));
create policy company_kpi_targets_delete on company_kpi_targets
  for delete using (can_manage_company(company_id));
