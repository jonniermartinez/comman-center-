import "server-only"

import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/database.types"

/** Cliente sin tipar, solo para el constructor de consultas genérico de abajo. */
interface ConsultaSinTipar {
  select: (cols: string, opts?: { count: "exact" }) => ConsultaSinTipar
  eq: (col: string, val: unknown) => ConsultaSinTipar
  gte: (col: string, val: unknown) => ConsultaSinTipar
  lte: (col: string, val: unknown) => ConsultaSinTipar
  or: (filtro: string) => ConsultaSinTipar
  order: (col: string, opts: { ascending: boolean }) => ConsultaSinTipar
  range: (desde: number, hasta: number) => ConsultaSinTipar
  limit: (n: number) => ConsultaSinTipar
  then: Promise<{ data: unknown[] | null; count: number | null; error: { message: string } | null }>["then"]
}
interface SupabaseSinTipar {
  from: (tabla: string) => ConsultaSinTipar
}

export type SaleRow = Database["public"]["Tables"]["sales"]["Row"]
export type PaymentRow = Database["public"]["Tables"]["payments"]["Row"]
export type ActivityRow = Database["public"]["Views"]["v_daily_activity"]["Row"]
export type CashRow = Database["public"]["Tables"]["cash_movements"]["Row"]
export type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"]

export const POR_PAGINA = 25

export interface Filtros {
  desde?: string
  hasta?: string
  branchId?: string
  staffId?: string
  /** Texto libre: busca por nombre o documento del cliente. */
  q?: string
  page?: number
}

export interface Pagina<T> {
  rows: T[]
  total: number
  page: number
  pageSize: number
}

/**
 * Lee `searchParams` de una página y los deja en filtros usables.
 *
 * Los filtros viven en la URL a propósito: así un enlace a "las ventas de
 * Palmira en marzo" se puede pegar en un chat, y volver atrás en el navegador
 * hace lo que uno espera.
 */
export function leerFiltros(params: Record<string, string | string[] | undefined>): Filtros {
  const uno = (k: string) => {
    const v = params[k]
    return typeof v === "string" && v && v !== "todos" && v !== "todas" ? v : undefined
  }
  return {
    desde: uno("desde"),
    hasta: uno("hasta"),
    branchId: uno("sede"),
    staffId: uno("responsable"),
    q: uno("q"),
    page: Math.max(0, Number(uno("p") ?? 0) || 0),
  }
}

/**
 * Consulta paginada contra una tabla de registros.
 *
 * La paginación es del servidor —`range` más el conteo exacto— porque estas
 * tablas tienen decenas de miles de filas: traerlas todas para cortarlas en el
 * navegador es justo lo que hay que evitar.
 */
async function consultar<T>(
  tabla: "sales" | "payments" | "v_daily_activity" | "cash_movements" | "appointments",
  companyId: string,
  filtros: Filtros,
  opciones: {
    campoFecha: string
    orden?: string
    busqueda?: string[]
  },
): Promise<Pagina<T>> {
  // El cliente se usa sin tipar para poder armar la consulta una sola vez para
  // las cinco tablas: con el tipo generado, cada `.eq` exige la tabla concreta.
  // El tipo de las filas se recupera al devolverlas como `T`.
  const supabase = (await createClient()) as unknown as SupabaseSinTipar
  const page = filtros.page ?? 0
  const desde = page * POR_PAGINA

  let query = supabase
    .from(tabla)
    .select("*", { count: "exact" })
    .eq("company_id", companyId)
    .order(opciones.orden ?? opciones.campoFecha, { ascending: false })
    .range(desde, desde + POR_PAGINA - 1)

  if (filtros.desde) query = query.gte(opciones.campoFecha, filtros.desde)
  if (filtros.hasta) query = query.lte(opciones.campoFecha, filtros.hasta)
  if (filtros.branchId) query = query.eq("branch_id", filtros.branchId)
  if (filtros.staffId) query = query.eq("staff_id", filtros.staffId)
  if (filtros.q && opciones.busqueda?.length) {
    const patron = `%${filtros.q}%`
    query = query.or(opciones.busqueda.map((c) => `${c}.ilike.${patron}`).join(","))
  }

  const { data, count, error } = await query
  if (error) throw new Error(`${tabla}: ${error.message}`)

  return {
    rows: (data ?? []) as T[],
    total: count ?? 0,
    page,
    pageSize: POR_PAGINA,
  }
}

export function listSales(companyId: string, filtros: Filtros) {
  return consultar<SaleRow>("sales", companyId, filtros, {
    campoFecha: "report_date",
    busqueda: ["licencia_nombre", "credito_nombre", "licencia_id", "credito_id", "ref_credito"],
  })
}

export function listPayments(companyId: string, filtros: Filtros) {
  return consultar<PaymentRow>("payments", companyId, filtros, {
    campoFecha: "report_date",
    busqueda: ["titular_nombre", "titular_id", "ref_credito"],
  })
}

export function listActivity(companyId: string, filtros: Filtros) {
  return consultar<ActivityRow>("v_daily_activity", companyId, filtros, {
    campoFecha: "report_date",
    busqueda: ["responsable_nombre"],
  })
}

export function listCashMovements(companyId: string, filtros: Filtros) {
  return consultar<CashRow>("cash_movements", companyId, filtros, {
    campoFecha: "report_date",
    busqueda: ["nombre", "identificacion", "factura", "observacion"],
  })
}

export function listAppointments(companyId: string, filtros: Filtros) {
  return consultar<AppointmentRow>("appointments", companyId, filtros, {
    campoFecha: "scheduled_at",
    busqueda: ["nombre", "celular"],
  })
}

/** Totales del rango filtrado, para la franja de arriba de cada listado. */
export async function totalesVentas(companyId: string, filtros: Filtros) {
  const supabase = await createClient()
  let query = supabase
    .from("sales")
    .select("valor_final, recaudo, saldo, cantidad_final")
    .eq("company_id", companyId)
    .limit(20000)
  if (filtros.desde) query = query.gte("report_date", filtros.desde)
  if (filtros.hasta) query = query.lte("report_date", filtros.hasta)
  if (filtros.branchId) query = query.eq("branch_id", filtros.branchId)
  if (filtros.staffId) query = query.eq("staff_id", filtros.staffId)

  const { data } = await query
  return (data ?? []).reduce(
    (acc, r) => ({
      facturacion: acc.facturacion + Number(r.valor_final ?? 0),
      recaudo: acc.recaudo + Number(r.recaudo ?? 0),
      saldo: acc.saldo + Number(r.saldo ?? 0),
      licencias: acc.licencias + Number(r.cantidad_final ?? 0),
    }),
    { facturacion: 0, recaudo: 0, saldo: 0, licencias: 0 },
  )
}
