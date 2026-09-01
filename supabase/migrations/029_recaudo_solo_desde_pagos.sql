-- ============================================================
-- Command Center · 029 · El recaudo de una venta lo mandan sus pagos
--
-- "Abonado hoy" se digitaba en el formulario de la venta y quedaba en
-- sales.recaudo, pero los dashboards suman la tabla payments: una venta con
-- abono aparecia recaudada en la pantalla de Ventas y en cero en el resto de
-- la aplicacion. El Excel importado no tenia ese hueco —cada venta con recaudo
-- trae su pago espejo, uno a uno— asi que la fuente de verdad es payments.
--
-- El campo se retira del formulario y estas dos funciones dejan sales.recaudo
-- y sales.saldo como reflejo calculado, no como algo que se escribe a mano.
--
-- No hay backfill a proposito: un pago del historico que quedo sin enlazar
-- (payments.sale_id nulo) sigue siendo plata real, y recalcular hoy todas las
-- ventas la borraria de sus columnas. Cada venta se recalcula la primera vez
-- que alguien toca uno de sus pagos.
-- ============================================================

/*
 * El saldo nunca se digita: es lo facturado menos lo recaudado.
 *
 * Sin piso en cero a proposito. Un saldo negativo es un sobrepago y es dato
 * real: 303 ventas del historico lo traen del Excel. Recortarlo a cero borraria
 * plata que el cliente si abono de mas.
 */
create or replace function sales_calcular_saldo()
returns trigger
language plpgsql
as $$
begin
  new.saldo := coalesce(new.valor_final, 0) - coalesce(new.recaudo, 0);
  return new;
end;
$$;

drop trigger if exists sales_saldo on sales;
create trigger sales_saldo
  before insert or update on sales
  for each row execute function sales_calcular_saldo();

/*
 * Recalcula el recaudo de la venta que toca un pago.
 *
 * Va como security definer porque quien registra un pago no necesariamente
 * puede actualizar la venta: un asesor registra el recaudo de un credito que
 * vendio otro y la politica de update de sales lo frenaria a mitad del
 * trigger. El definer solo suma los pagos ya enlazados a esa venta.
 */
create or replace function payments_refrescar_recaudo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  afectadas uuid[] := '{}';
  afectada  uuid;
begin
  -- En un UPDATE que mueve el pago de una venta a otra hay que recalcular las
  -- dos. OLD y NEW se leen por separado porque en un trigger de DELETE la fila
  -- NEW no existe y tocarla revienta.
  if tg_op <> 'INSERT' and old.sale_id is not null then
    afectadas := afectadas || old.sale_id;
  end if;
  if tg_op <> 'DELETE' and new.sale_id is not null then
    afectadas := afectadas || new.sale_id;
  end if;

  foreach afectada in array afectadas loop
    update sales s
       set recaudo = (select coalesce(sum(p.amount), 0) from payments p where p.sale_id = s.id)
     where s.id = afectada;
  end loop;

  return null;
end;
$$;

drop trigger if exists payments_recaudo on payments;
create trigger payments_recaudo
  after insert or update or delete on payments
  for each row execute function payments_refrescar_recaudo();
