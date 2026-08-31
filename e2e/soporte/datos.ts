/**
 * Constructores de filas válidas.
 *
 * Existen para que una prueba negativa falle por el motivo que dice.
 *
 * Si se escribe a mano `{ company_id, sale_date, amount }` el INSERT revienta
 * —`sales` no tiene esas columnas— y la prueba "el asesor no puede escribir en
 * otra empresa" pasa en verde sin haber probado ni una política. Una prueba de
 * seguridad que pasa por un error de tecleo es peor que no tenerla: da confianza
 * falsa. Por eso los payloads se construyen en un solo sitio, con las columnas
 * reales, y toda prueba negativa lleva su control positivo al lado: la misma
 * fila tiene que entrar cuando sí está permitida.
 */

/** Primero del mes de una fecha ISO: es lo que guarda `period_month`. */
export function mesDe(fechaISO: string): string {
  return `${fechaISO.slice(0, 7)}-01`
}

export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export interface Contexto {
  companyId: string
  branchId: string
  staffId?: string | null
}

/** Una venta mínima pero completa: todo lo NOT NULL sin defecto. */
export function venta(ctx: Contexto, extra: Record<string, unknown> = {}) {
  const fecha = hoyISO()
  return {
    company_id: ctx.companyId,
    branch_id: ctx.branchId,
    staff_id: ctx.staffId ?? null,
    report_date: fecha,
    period_month: mesDe(fecha),
    valor_final: 1000,
    ...extra,
  }
}

/** Un pago mínimo. `amount` no tiene defecto, al contrario que en `sales`. */
export function pago(ctx: Contexto, extra: Record<string, unknown> = {}) {
  const fecha = hoyISO()
  return {
    company_id: ctx.companyId,
    branch_id: ctx.branchId,
    report_date: fecha,
    period_month: mesDe(fecha),
    amount: 1000,
    ...extra,
  }
}

/** Una agenda mínima. */
export function agenda(ctx: Contexto, extra: Record<string, unknown> = {}) {
  const fecha = hoyISO()
  return {
    company_id: ctx.companyId,
    branch_id: ctx.branchId,
    staff_id: ctx.staffId ?? null,
    report_date: fecha,
    period_month: mesDe(fecha),
    ...extra,
  }
}
