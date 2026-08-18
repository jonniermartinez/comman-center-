-- ============================================================
-- Command Center · 004 · Catálogos
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
-- Sin datos de ejemplo.
--
-- Las empresas, sedes y usuarios se crean desde la aplicación. El primer super
-- admin lo resuelve el trigger `handle_new_auth_user` de 005: el primer usuario
-- que aparezca en auth.users nace super_admin y activo. Ver docs/SUPABASE.md.
-- ============================================================
