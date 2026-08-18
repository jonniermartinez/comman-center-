-- ============================================================
-- Command Center · 004 · Catálogos y datos iniciales
-- Idempotente: se puede volver a correr sin duplicar.
-- ============================================================

-- ------------------------------------------------------------
-- Módulos
-- ------------------------------------------------------------
insert into modules (code, name, description, sort_order) values
  ('kpi_diario',     'KPI Diario',          'Llamadas, ventas, agendas y venta presencial por jornada. Calcula los seis ratios.', 1),
  ('gestion_diaria', 'Gestión Diaria (CRM)','Chats por responder, tareas del día, tareas caducadas y certificados por jornada.', 2),
  ('reporte_ventas', 'Reporte de Ventas',   'Ventas y licencias por financiación, renovaciones, facturación y recaudo.', 3)
on conflict (code) do update
  set name = excluded.name,
      description = excluded.description,
      sort_order = excluded.sort_order;

-- ------------------------------------------------------------
-- Financiaciones
-- ------------------------------------------------------------
insert into financing_types (code, name, sort_order) values
  ('brilla',       'Brilla',       1),
  ('contado',      'Contado',      2),
  ('cincuenta',    '50/50',        3),
  ('sistecredito', 'Sistecrédito', 4),
  ('addi',         'Addi',         5),
  ('solvente',     'Solvente',     6)
on conflict (code) do update set name = excluded.name, sort_order = excluded.sort_order;

-- ------------------------------------------------------------
-- Medios de recaudo
-- ------------------------------------------------------------
insert into payment_methods (code, name, sort_order) values
  ('addi',         'Addi',         1),
  ('brilla',       'Brilla',       2),
  ('datafono',     'Datáfono',     3),
  ('efectivo',     'Efectivo',     4),
  ('sistecredito', 'Sistecrédito', 5),
  ('solvente',     'Solvente',     6),
  ('transferencia','Transferencia',7)
on conflict (code) do update set name = excluded.name, sort_order = excluded.sort_order;

-- ------------------------------------------------------------
-- Métricas para objetivos comerciales
-- ------------------------------------------------------------
insert into metrics (code, name, unit, sort_order) values
  ('ventas_mensuales',         'Ventas mensuales',           'cantidad',   1),
  ('licencias_mensuales',      'Licencias mensuales',        'cantidad',   2),
  ('facturacion',              'Facturación',                'moneda',     3),
  ('recaudo',                  'Recaudo',                    'moneda',     4),
  ('ventas_efectivas',         'Ventas efectivas (llamada)', 'cantidad',   5),
  ('ratio_contactabilidad',    'Ratio contactabilidad',      'porcentaje', 6),
  ('ratio_conversion_llamada', 'Ratio conversión llamada',   'porcentaje', 7)
on conflict (code) do update set name = excluded.name, unit = excluded.unit, sort_order = excluded.sort_order;

-- ============================================================
-- Empresas cliente iniciales
-- ============================================================
insert into companies (name, slug, city, department, crm_label) values
  ('Ruta Segura', 'ruta-segura', 'Buga', 'Valle del Cauca', 'Ruta Segura'),
  ('LV Unión',    'lv-union',    'Buga', 'Valle del Cauca', 'LV Unión')
on conflict (slug) do nothing;

-- Sedes. Ruta Segura opera en dos municipios; LV Unión en uno.
insert into branches (company_id, name, city, department, is_primary)
select c.id, v.name, v.city, 'Valle del Cauca', v.is_primary
from companies c
join (values
  ('ruta-segura', 'Sede Buga',      'Buga',  true),
  ('ruta-segura', 'Sede Tuluá',     'Tuluá', false),
  ('lv-union',    'Sede principal', 'Buga',  true)
) as v(slug, name, city, is_primary) on v.slug = c.slug
on conflict (company_id, name) do nothing;

-- Todos los módulos habilitados para ambas
insert into company_modules (company_id, module_code)
select c.id, m.code
from companies c cross join modules m
where c.slug in ('ruta-segura', 'lv-union')
on conflict do nothing;

-- Financiaciones y medios de recaudo activos para ambas
insert into company_financing_types (company_id, financing_code, sort_order)
select c.id, f.code, f.sort_order
from companies c cross join financing_types f
where c.slug in ('ruta-segura', 'lv-union')
on conflict do nothing;

insert into company_payment_methods (company_id, method_code, sort_order)
select c.id, pm.code, pm.sort_order
from companies c cross join payment_methods pm
where c.slug in ('ruta-segura', 'lv-union')
on conflict do nothing;

-- ============================================================
-- Primer super admin
--
-- No se puede crear acá porque profiles.id referencia auth.users.
-- Pasos:
--   1. Authentication → Users → "Add user" en el panel de Supabase.
--   2. Copiar el UUID que queda y correr esto reemplazando los valores:
--
--   insert into profiles (id, full_name, email, role, status)
--   values ('<UUID-DE-AUTH>', 'Jonnier A. Martínez', 'jonnieralejandrom@gmail.com',
--           'super_admin', 'activo')
--   on conflict (id) do update
--     set role = 'super_admin', status = 'activo';
--
-- A partir de ahí los demás usuarios se crean desde /admin/usuarios.
-- ============================================================
