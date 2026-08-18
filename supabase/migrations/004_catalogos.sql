-- Catalogos base. Idempotente. Sin datos de ejemplo: las empresas, sedes y
-- usuarios se crean desde la aplicacion.

insert into modules (code, name, description, sort_order) values
  ('kpi_diario',     'KPI Diario',           'Llamadas, ventas, agendas y venta presencial por jornada. Calcula los seis ratios.', 1),
  ('gestion_diaria', 'Gestion Diaria (CRM)', 'Chats por responder, tareas del dia, tareas caducadas y certificados por jornada.', 2),
  ('reporte_ventas', 'Reporte de Ventas',    'Ventas y licencias por financiacion, renovaciones, facturacion y recaudo.', 3)
on conflict (code) do update
  set name = excluded.name, description = excluded.description, sort_order = excluded.sort_order;

insert into financing_types (code, name, sort_order) values
  ('brilla',       'Brilla',       1),
  ('contado',      'Contado',      2),
  ('cincuenta',    '50/50',        3),
  ('sistecredito', 'Sistecredito', 4),
  ('addi',         'Addi',         5),
  ('solvente',     'Solvente',     6)
on conflict (code) do update set name = excluded.name, sort_order = excluded.sort_order;

insert into payment_methods (code, name, sort_order) values
  ('addi',          'Addi',          1),
  ('brilla',        'Brilla',        2),
  ('datafono',      'Datafono',      3),
  ('efectivo',      'Efectivo',      4),
  ('sistecredito',  'Sistecredito',  5),
  ('solvente',      'Solvente',      6),
  ('transferencia', 'Transferencia', 7)
on conflict (code) do update set name = excluded.name, sort_order = excluded.sort_order;

insert into metrics (code, name, unit, sort_order) values
  ('ventas_mensuales',         'Ventas mensuales',           'cantidad',   1),
  ('licencias_mensuales',      'Licencias mensuales',        'cantidad',   2),
  ('facturacion',              'Facturacion',                'moneda',     3),
  ('recaudo',                  'Recaudo',                    'moneda',     4),
  ('ventas_efectivas',         'Ventas efectivas (llamada)', 'cantidad',   5),
  ('ratio_contactabilidad',    'Ratio contactabilidad',      'porcentaje', 6),
  ('ratio_conversion_llamada', 'Ratio conversion llamada',   'porcentaje', 7)
on conflict (code) do update set name = excluded.name, unit = excluded.unit, sort_order = excluded.sort_order;
