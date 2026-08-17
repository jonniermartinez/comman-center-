import type {
  AmountEntry,
  DailyManagement,
  Database,
  Objective,
  SalesEntry,
} from "./store/types"

/**
 * Cálculo de ratios y agregados. Espejo de supabase/migrations/002_views.sql,
 * para que la UI y el Postgres den exactamente el mismo número.
 */

/** División segura: null cuando el denominador es 0 (se muestra como "—", no como 0%). */
export function safeRatio(numerador: number, denominador: number): number | null {
  if (!denominador) return null
  return numerador / denominador
}

export interface KpiRatios {
  volumen_venta_general: number | null
  ratio_conversion_llamada: number | null
  ratio_contactabilidad: number | null
  ratio_conversion_agendas: number | null
  ratio_venta_presencial: number | null
  volumen_venta_agendas: number | null
}

export interface KpiTotals {
  llamadas_realizadas: number
  llamadas_contestadas: number
  ventas_efectivas: number
  agendas_dia: number
  atencion_agendas: number
  clientes_atendidos: number
  ventas_exitosas: number
  llamada_agenda: number
}

export const EMPTY_TOTALS: KpiTotals = {
  llamadas_realizadas: 0,
  llamadas_contestadas: 0,
  ventas_efectivas: 0,
  agendas_dia: 0,
  atencion_agendas: 0,
  clientes_atendidos: 0,
  ventas_exitosas: 0,
  llamada_agenda: 0,
}

export function sumKpi(rows: KpiTotals[]): KpiTotals {
  return rows.reduce<KpiTotals>(
    (acc, r) => ({
      llamadas_realizadas: acc.llamadas_realizadas + r.llamadas_realizadas,
      llamadas_contestadas: acc.llamadas_contestadas + r.llamadas_contestadas,
      ventas_efectivas: acc.ventas_efectivas + r.ventas_efectivas,
      agendas_dia: acc.agendas_dia + r.agendas_dia,
      atencion_agendas: acc.atencion_agendas + r.atencion_agendas,
      clientes_atendidos: acc.clientes_atendidos + r.clientes_atendidos,
      ventas_exitosas: acc.ventas_exitosas + r.ventas_exitosas,
      llamada_agenda: acc.llamada_agenda + r.llamada_agenda,
    }),
    { ...EMPTY_TOTALS },
  )
}

/**
 * Los ratios se recalculan sobre los totales. Nunca se promedian los ratios
 * diarios: el promedio de porcentajes da un número falso.
 */
export function computeRatios(t: KpiTotals): KpiRatios {
  return {
    volumen_venta_general: safeRatio(t.ventas_efectivas, t.llamadas_contestadas),
    ratio_conversion_llamada: safeRatio(t.ventas_efectivas, t.llamadas_realizadas),
    ratio_contactabilidad: safeRatio(t.llamadas_contestadas, t.llamadas_realizadas),
    ratio_conversion_agendas: safeRatio(t.atencion_agendas, t.agendas_dia),
    ratio_venta_presencial: safeRatio(t.ventas_exitosas, t.clientes_atendidos),
    volumen_venta_agendas: safeRatio(t.llamada_agenda, t.llamadas_contestadas),
  }
}

/** Los seis bloques del pantallazo "KPI Diario", en el mismo orden. */
export const RATIO_BLOCKS: {
  key: keyof KpiRatios
  label: string
  numerador: keyof KpiTotals
  denominador: keyof KpiTotals
}[] = [
  { key: "volumen_venta_general", label: "Volumen venta general", numerador: "ventas_efectivas", denominador: "llamadas_contestadas" },
  { key: "ratio_conversion_llamada", label: "Ratio conversión llamada", numerador: "ventas_efectivas", denominador: "llamadas_realizadas" },
  { key: "ratio_contactabilidad", label: "Ratio contactabilidad", numerador: "llamadas_contestadas", denominador: "llamadas_realizadas" },
  { key: "ratio_conversion_agendas", label: "Ratio conversión agendas", numerador: "atencion_agendas", denominador: "agendas_dia" },
  { key: "ratio_venta_presencial", label: "Ratio venta presencial", numerador: "ventas_exitosas", denominador: "clientes_atendidos" },
  { key: "volumen_venta_agendas", label: "Volumen venta agendas", numerador: "llamada_agenda", denominador: "llamadas_contestadas" },
]

export const KPI_FIELD_LABELS: Record<keyof KpiTotals, string> = {
  llamadas_realizadas: "Llamadas realizadas",
  llamadas_contestadas: "Llamadas contestadas",
  ventas_efectivas: "Ventas efectivas",
  agendas_dia: "Agendas del día",
  atencion_agendas: "Atención agendas",
  clientes_atendidos: "Total clientes atendidos",
  ventas_exitosas: "Ventas exitosas",
  llamada_agenda: "Llamada agenda",
}

// ---------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------

export function monthOf(date: string): string {
  return `${date.slice(0, 7)}-01`
}

export function isSameMonth(date: string, month: string): boolean {
  return date.slice(0, 7) === month.slice(0, 7)
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number)
  const nombres = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
  return `${nombres[m - 1]} ${y}`
}

/** Días hábiles (lunes a sábado, como opera el negocio) en un mes. */
export function businessDaysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number)
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  let count = 0
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() !== 0) count++
  }
  return count
}

export function businessDaysElapsed(month: string, today: string): number {
  if (!isSameMonth(today, month)) return businessDaysInMonth(month)
  const [y, m] = month.split("-").map(Number)
  const last = Number(today.slice(8, 10))
  let count = 0
  for (let d = 1; d <= last; d++) {
    if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() !== 0) count++
  }
  return count
}

// ---------------------------------------------------------------
// Agregados de ventas / facturación / recaudo
// ---------------------------------------------------------------

export interface SalesTotals {
  ventas: number
  licencias: number
  renovaciones: number
  facturacion: number
  recaudo: number
}

export function salesTotals(
  sales: SalesEntry[],
  billing: AmountEntry[],
  collection: AmountEntry[],
): SalesTotals {
  return {
    ventas: sales.filter((s) => s.kind === "venta").reduce((a, s) => a + s.ventas, 0),
    licencias: sales.filter((s) => s.kind === "venta").reduce((a, s) => a + s.licencias, 0),
    renovaciones: sales.filter((s) => s.kind === "renovacion").reduce((a, s) => a + s.ventas, 0),
    facturacion: billing.reduce((a, b) => a + b.amount, 0),
    recaudo: collection.reduce((a, c) => a + c.amount, 0),
  }
}

/**
 * Filtro común. `branchId` sin valor significa "toda la empresa": el total de la
 * empresa es la suma de sus sedes.
 */
function enAlcance(
  row: { company_id: string; branch_id: string; report_date: string },
  companyId: string,
  branchId: string | undefined,
) {
  return row.company_id === companyId && (!branchId || row.branch_id === branchId)
}

/** Totales del mes: alimenta las tarjetas de cumplimiento. */
export function companyMonthTotals(
  db: Database,
  companyId: string,
  month: string,
  branchId?: string,
): SalesTotals {
  const enMes = (r: { company_id: string; branch_id: string; report_date: string }) =>
    enAlcance(r, companyId, branchId) && isSameMonth(r.report_date, month)
  return salesTotals(
    db.sales_entries.filter(enMes),
    db.billing_entries.filter(enMes),
    db.collection_entries.filter(enMes),
  )
}

export function companyDayTotals(
  db: Database,
  companyId: string,
  date: string,
  branchId?: string,
): SalesTotals {
  const enDia = (r: { company_id: string; branch_id: string; report_date: string }) =>
    enAlcance(r, companyId, branchId) && r.report_date === date
  return salesTotals(
    db.sales_entries.filter(enDia),
    db.billing_entries.filter(enDia),
    db.collection_entries.filter(enDia),
  )
}

export function companyMonthKpi(
  db: Database,
  companyId: string,
  month: string,
  userId?: string,
  branchId?: string,
) {
  const rows = db.daily_kpi.filter(
    (k) =>
      enAlcance(k, companyId, branchId) &&
      isSameMonth(k.report_date, month) &&
      (!userId || k.user_id === userId),
  )
  const totals = sumKpi(rows)
  return { totals, ratios: computeRatios(totals), rows }
}

/** Totales del mes por sede: el desglose del dashboard de empresa. */
export function branchMonthTotals(db: Database, companyId: string, month: string) {
  return db.branches
    .filter((b) => b.company_id === companyId)
    .map((branch) => {
      const ventas = companyMonthTotals(db, companyId, month, branch.id)
      const { totals, ratios } = companyMonthKpi(db, companyId, month, undefined, branch.id)
      const comerciales = db.company_users.filter(
        (cu) => cu.branch_id === branch.id && !cu.removed_at,
      ).length
      return { branch, ventas, kpi: totals, ratios, comerciales }
    })
    .sort((a, b) => b.ventas.ventas - a.ventas.ventas)
}

// ---------------------------------------------------------------
// Cumplimiento de objetivos
// ---------------------------------------------------------------

export interface ObjectiveProgress {
  objective: Objective
  metricName: string
  unit: "cantidad" | "moneda" | "porcentaje"
  target: number
  real: number
  /** null cuando no hay meta definida. */
  cumplimiento: number | null
  /** Proyección a fin de mes según días hábiles transcurridos. */
  proyeccion: number
  userName?: string
}

/** Valor real de una métrica. Debe coincidir con v_objective_progress del SQL. */
export function realValueFor(
  db: Database,
  companyId: string,
  month: string,
  metricCode: string,
  userId?: string | null,
): number {
  if (userId) {
    const { totals, ratios } = companyMonthKpi(db, companyId, month, userId)
    switch (metricCode) {
      case "ventas_efectivas":
        return totals.ventas_efectivas
      case "ratio_contactabilidad":
        return (ratios.ratio_contactabilidad ?? 0) * 100
      case "ratio_conversion_llamada":
        return (ratios.ratio_conversion_llamada ?? 0) * 100
      default:
        return 0
    }
  }

  const totals = companyMonthTotals(db, companyId, month)
  const { totals: kpi, ratios } = companyMonthKpi(db, companyId, month)
  switch (metricCode) {
    case "ventas_mensuales":
      return totals.ventas
    case "licencias_mensuales":
      return totals.licencias
    case "facturacion":
      return totals.facturacion
    case "recaudo":
      return totals.recaudo
    case "ventas_efectivas":
      return kpi.ventas_efectivas
    case "ratio_contactabilidad":
      return (ratios.ratio_contactabilidad ?? 0) * 100
    case "ratio_conversion_llamada":
      return (ratios.ratio_conversion_llamada ?? 0) * 100
    default:
      return 0
  }
}

export function objectiveProgress(
  db: Database,
  companyId: string,
  month: string,
  today: string,
): ObjectiveProgress[] {
  const elapsed = businessDaysElapsed(month, today)
  const total = businessDaysInMonth(month)

  return db.objectives
    .filter((o) => o.company_id === companyId && o.period_month === month)
    .map((o) => {
      const metric = db.metrics.find((m) => m.code === o.metric_code)
      const real = realValueFor(db, companyId, month, o.metric_code, o.user_id)
      const isRatio = metric?.unit === "porcentaje"
      return {
        objective: o,
        metricName: metric?.name ?? o.metric_code,
        unit: metric?.unit ?? "cantidad",
        target: o.target_value,
        real,
        cumplimiento: safeRatio(real, o.target_value),
        // Los ratios no se proyectan: ya son una tasa, no un acumulado.
        proyeccion: isRatio || !elapsed ? real : (real / elapsed) * total,
        userName: o.user_id
          ? db.profiles.find((p) => p.id === o.user_id)?.full_name
          : undefined,
      }
    })
    .sort((a, b) => {
      const sa = db.metrics.find((m) => m.code === a.objective.metric_code)?.sort_order ?? 99
      const sb = db.metrics.find((m) => m.code === b.objective.metric_code)?.sort_order ?? 99
      return sa - sb || (a.userName ?? "").localeCompare(b.userName ?? "")
    })
}

// ---------------------------------------------------------------
// Gestión Diaria: inicial vs final
// ---------------------------------------------------------------

export interface ManagementProgress {
  user_id: string
  responsable_nombre: string
  chats_inicial: number
  chats_final: number
  tareas_inicial: number
  tareas_final: number
  caducadas_inicial: number
  caducadas_final: number
  certificados: number
}

export function managementProgress(
  rows: DailyManagement[],
): ManagementProgress[] {
  const byUser = new Map<string, DailyManagement[]>()
  for (const r of rows) {
    const list = byUser.get(r.user_id) ?? []
    list.push(r)
    byUser.set(r.user_id, list)
  }

  return [...byUser.entries()].map(([user_id, list]) => {
    const pick = (j: DailyManagement["jornada"]) => list.find((r) => r.jornada === j)
    const inicial = pick("inicial")
    const final = pick("final") ?? pick("medio_dia")
    return {
      user_id,
      responsable_nombre: list[0].responsable_nombre,
      chats_inicial: inicial?.chats_por_responder ?? 0,
      chats_final: final?.chats_por_responder ?? 0,
      tareas_inicial: inicial?.tareas_del_dia ?? 0,
      tareas_final: final?.tareas_del_dia ?? 0,
      caducadas_inicial: inicial?.tareas_caducadas ?? 0,
      caducadas_final: final?.tareas_caducadas ?? 0,
      certificados: final?.certificados ?? 0,
    }
  })
}

// ---------------------------------------------------------------
// Estado de captura del día
// ---------------------------------------------------------------

export interface CaptureStatus {
  user_id: string
  full_name: string
  kpi: boolean
  gestion: boolean
}

export function captureStatus(
  db: Database,
  companyId: string,
  date: string,
  branchId?: string,
): CaptureStatus[] {
  return db.company_users
    .filter((cu) => cu.company_id === companyId && !cu.removed_at)
    .filter((cu) => !branchId || cu.branch_id === branchId)
    .map((cu) => db.profiles.find((p) => p.id === cu.user_id))
    .filter((p): p is NonNullable<typeof p> => !!p && !p.deleted_at && p.status === "activo")
    .map((p) => ({
      user_id: p.id,
      full_name: p.full_name,
      kpi: db.daily_kpi.some(
        (k) => k.company_id === companyId && k.user_id === p.id && k.report_date === date,
      ),
      gestion: db.daily_management.some(
        (d) => d.company_id === companyId && d.user_id === p.id && d.report_date === date,
      ),
    }))
}

/** Serie diaria del mes para las gráficas. */
export function dailySeries(db: Database, companyId: string, month: string, branchId?: string) {
  const dates = new Set<string>()
  const recolectar = (rows: { company_id: string; branch_id: string; report_date: string }[]) => {
    for (const r of rows) {
      if (enAlcance(r, companyId, branchId) && isSameMonth(r.report_date, month)) {
        dates.add(r.report_date)
      }
    }
  }
  recolectar(db.sales_entries)
  recolectar(db.billing_entries)
  recolectar(db.collection_entries)
  recolectar(db.daily_kpi)

  return [...dates].sort().map((date) => {
    const t = companyDayTotals(db, companyId, date, branchId)
    const kpi = sumKpi(
      db.daily_kpi.filter((k) => enAlcance(k, companyId, branchId) && k.report_date === date),
    )
    return {
      date,
      dia: Number(date.slice(8, 10)),
      ventas: t.ventas,
      licencias: t.licencias,
      facturacion: t.facturacion,
      recaudo: t.recaudo,
      llamadas_realizadas: kpi.llamadas_realizadas,
      llamadas_contestadas: kpi.llamadas_contestadas,
    }
  })
}
