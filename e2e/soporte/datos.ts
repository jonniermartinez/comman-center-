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

/**
 * Una agenda mínima.
 *
 * No lleva `report_date` ni `period_month`: `appointments` guarda la cita en
 * `scheduled_at`, que es un instante, no el día en que se reportó.
 */
export function agenda(ctx: Contexto, extra: Record<string, unknown> = {}) {
  return {
    company_id: ctx.companyId,
    branch_id: ctx.branchId,
    staff_id: ctx.staffId ?? null,
    scheduled_at: new Date().toISOString(),
    ...extra,
  }
}

/** Un movimiento de caja mínimo. `kind` es 'entrada' o 'salida'. */
export function movimiento(ctx: Contexto, extra: Record<string, unknown> = {}) {
  const fecha = hoyISO()
  return {
    company_id: ctx.companyId,
    branch_id: ctx.branchId,
    report_date: fecha,
    period_month: mesDe(fecha),
    kind: "entrada",
    amount: 1000,
    ...extra,
  }
}

/**
 * Una jornada mínima.
 *
 * Lleva `responsable_nombre` además de `staff_id`: la fila guarda una foto del
 * nombre para que el histórico siga leyéndose aunque la persona se renombre.
 */
export function jornada(ctx: Contexto, extra: Record<string, unknown> = {}) {
  const fecha = hoyISO()
  return {
    company_id: ctx.companyId,
    branch_id: ctx.branchId,
    staff_id: ctx.staffId ?? null,
    responsable_nombre: "E2E",
    report_date: fecha,
    period_month: mesDe(fecha),
    ...extra,
  }
}

/**
 * Un día distinto por prueba, hacia atrás desde hoy.
 *
 * `daily_activity` tiene única (empresa, sede, fecha, persona): una jornada por
 * persona y día. Si varias pruebas usan la misma fecha chocan entre ellas, y el
 * fallo parece un permiso mal puesto cuando en realidad es la regla del negocio
 * funcionando. Nunca hacia delante: un trigger rechaza fechas futuras.
 *
 * Basta con una fecha por prueba porque cada corrida empieza con la empresa de
 * pruebas recién creada. Corriendo con `E2E_SIN_LIMPIEZA=1` dos veces seguidas
 * sí chocan: las jornadas no se pueden borrar —no hay política de DELETE— así
 * que las de la corrida anterior siguen ocupando su día. Es esperado; para
 * repetir, hay que dejar que el desmontaje se lleve la empresa.
 */
export function diaDistinto(n: number) {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() - n)
  const iso = fecha.toISOString().slice(0, 10)
  return { report_date: iso, period_month: mesDe(iso) }
}
