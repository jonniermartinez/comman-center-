-- ============================================================
-- Command Center · 015 · Catálogo de módulos según el Excel real
--
-- Los tres módulos anteriores partían mal el trabajo: "KPI Diario" y "Gestión
-- Diaria" eran la misma hoja, y "Reporte de Ventas" era un cálculo, no una
-- captura. Los que quedan corresponden a lo que el equipo realmente llena.
-- ============================================================
delete from company_modules where module_code in ('kpi_diario', 'gestion_diaria', 'reporte_ventas');
delete from modules where code in ('kpi_diario', 'gestion_diaria', 'reporte_ventas');

insert into modules (code, name, description, sort_order) values
  ('ventas',            'Ventas',            'Créditos y licencias vendidas: cliente, producto, escuela, valores, recaudo y saldo.', 1),
  ('pagos',             'Pagos',             'Abonos recibidos contra cada crédito, por medio de pago.', 2),
  ('actividad_diaria',  'Gestión Diaria',    'Jornada, cola del CRM en tres momentos, agendas, llamadas y atenciones por persona y día.', 3),
  ('agendas',           'Agendas',           'Citas concertadas con clientes y su resultado.', 4),
  ('caja',              'Ingreso y Gasto',   'Movimientos de caja: entradas y salidas por concepto y medio de pago.', 5)
on conflict (code) do update
  set name = excluded.name,
      description = excluded.description,
      sort_order = excluded.sort_order;
