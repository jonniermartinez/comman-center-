-- ============================================================
-- Command Center · 017 · Pagos con la fecha deducida
--
-- En el histórico hay pagos sin fecha. Dejarlos fuera descuadra el recaudo
-- contra el Excel; ponerles una fecha inventada sin decirlo es peor. Cuando la
-- fecha se deduce de la venta a la que pertenece el pago, la fila entra con
-- esta marca puesta, y la interfaz puede advertirlo donde importe.
-- ============================================================
alter table payments add column if not exists date_estimated boolean not null default false;

comment on column payments.date_estimated is
  'La fecha no venía en el archivo: se tomó la de la venta asociada. El monto es real, el día es aproximado.';
