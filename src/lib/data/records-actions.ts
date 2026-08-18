"use server"

import { revalidatePath } from "next/cache"

import { requireSession } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import type { KpiTotals } from "@/lib/kpi"

export interface Result {
  ok: boolean
  error?: string
}

function refrescar() {
  revalidatePath("/", "layout")
}

/**
 * Traduce el error de Postgres a algo que se pueda leer en pantalla.
 *
 * Las reglas de negocio viven en la base —restricciones CHECK, índices únicos y
 * triggers—, así que acá no se repiten: se explican. Repetirlas en el cliente
 * es lo que hace que la app y la base terminen discrepando.
 */
function explicar(mensaje: string): string {
  if (mensaje.includes("fecha futura")) return "No se puede registrar una fecha futura."
  if (mensaje.includes("dk_contestadas"))
    return "Las llamadas contestadas no pueden superar las realizadas."
  if (mensaje.includes("dk_agendas"))
    return "La atención de agendas no puede superar las agendas del día."
  if (mensaje.includes("dk_presencial"))
    return "Las ventas exitosas no pueden superar los clientes atendidos."
  if (mensaje.includes("está eliminado"))
    return "El responsable está eliminado y no puede recibir registros nuevos."
  if (mensaje.includes("row-level security") || mensaje.includes("permission denied"))
    return "No tienes permiso para registrar en esta empresa."
  return mensaje
}

/**
 * Un registro por empresa + sede + fecha + responsable + jornada.
 *
 * Se usa `upsert` sobre esa combinación: reenviar el mismo día corrige el
 * registro en vez de duplicarlo, y la unicidad la garantiza el índice de la
 * base, no una consulta previa que podría quedar desactualizada.
 */
export async function saveDailyKpi(input: {
  company_id: string
  branch_id: string
  report_date: string
  user_id: string
  responsable_nombre: string
  jornada: "inicial" | "medio_dia" | "final"
  values: KpiTotals
  notas?: string
}): Promise<Result> {
  const session = await requireSession()
  const supabase = await createClient()

  const { error } = await supabase.from("daily_kpi").upsert(
    {
      company_id: input.company_id,
      branch_id: input.branch_id,
      report_date: input.report_date,
      user_id: input.user_id,
      responsable_nombre: input.responsable_nombre,
      jornada: input.jornada,
      ...input.values,
      notas: input.notas ?? null,
      created_by: session.profile.id,
      updated_by: session.profile.id,
    },
    { onConflict: "company_id,branch_id,report_date,user_id,jornada" },
  )

  if (error) return { ok: false, error: explicar(error.message) }

  refrescar()
  return { ok: true }
}

export async function saveDailyManagement(input: {
  company_id: string
  branch_id: string
  report_date: string
  user_id: string
  responsable_nombre: string
  jornada: "inicial" | "medio_dia" | "final"
  chats_por_responder: number
  tareas_del_dia: number
  tareas_caducadas: number
  certificados: number
  notas?: string
}): Promise<Result> {
  const session = await requireSession()
  const supabase = await createClient()

  const { error } = await supabase.from("daily_management").upsert(
    {
      company_id: input.company_id,
      branch_id: input.branch_id,
      report_date: input.report_date,
      user_id: input.user_id,
      responsable_nombre: input.responsable_nombre,
      jornada: input.jornada,
      chats_por_responder: input.chats_por_responder,
      tareas_del_dia: input.tareas_del_dia,
      tareas_caducadas: input.tareas_caducadas,
      certificados: input.certificados,
      notas: input.notas ?? null,
      created_by: session.profile.id,
      updated_by: session.profile.id,
    },
    { onConflict: "company_id,branch_id,report_date,user_id,jornada" },
  )

  if (error) return { ok: false, error: explicar(error.message) }

  refrescar()
  return { ok: true }
}

export interface SalesReportInput {
  company_id: string
  branch_id: string
  report_date: string
  /** financing_code → { ventas, licencias } */
  ventas: Record<string, { ventas: number; licencias: number }>
  renovaciones: Record<string, number>
  facturacion: Record<string, number>
  recaudo: Record<string, number>
}

/**
 * Reemplaza el reporte de un día en una sede.
 *
 * Se borran las líneas de ese día y se vuelven a escribir: el formulario es la
 * única fuente de verdad de ese día, así que una financiación que quedó en cero
 * tiene que desaparecer, no quedarse como línea vieja. Solo se toca esa sede;
 * lo que reportaron las demás no se roza.
 *
 * Es lo único de la app que borra filas de un registro histórico, y por eso la
 * base sí tiene política de DELETE en estas tres tablas.
 */
export async function saveSalesReport(input: SalesReportInput): Promise<Result> {
  const session = await requireSession()
  const supabase = await createClient()

  const { company_id, branch_id, report_date } = input
  const delDia = <T extends { eq: (col: string, val: string) => T }>(q: T) =>
    q.eq("company_id", company_id).eq("branch_id", branch_id).eq("report_date", report_date)

  const borrados = await Promise.all([
    delDia(supabase.from("sales_entries").delete()),
    delDia(supabase.from("billing_entries").delete()),
    delDia(supabase.from("collection_entries").delete()),
  ])
  const falloBorrado = borrados.find((r) => r.error)
  if (falloBorrado?.error) return { ok: false, error: explicar(falloBorrado.error.message) }

  const comun = {
    company_id,
    branch_id,
    report_date,
    created_by: session.profile.id,
    updated_by: session.profile.id,
  }

  const ventas = [
    ...Object.entries(input.ventas)
      .filter(([, v]) => v.ventas || v.licencias)
      .map(([financing_code, v]) => ({
        ...comun,
        financing_code,
        kind: "venta" as const,
        ventas: v.ventas,
        licencias: v.licencias,
      })),
    ...Object.entries(input.renovaciones)
      .filter(([, cantidad]) => cantidad > 0)
      .map(([financing_code, cantidad]) => ({
        ...comun,
        financing_code,
        kind: "renovacion" as const,
        ventas: cantidad,
        licencias: 0,
      })),
  ]

  const facturacion = Object.entries(input.facturacion)
    .filter(([, amount]) => amount > 0)
    .map(([financing_code, amount]) => ({ ...comun, financing_code, amount }))

  const recaudo = Object.entries(input.recaudo)
    .filter(([, amount]) => amount > 0)
    .map(([method_code, amount]) => ({ ...comun, method_code, amount }))

  const escrituras = await Promise.all([
    ventas.length ? supabase.from("sales_entries").insert(ventas) : { error: null },
    facturacion.length ? supabase.from("billing_entries").insert(facturacion) : { error: null },
    recaudo.length ? supabase.from("collection_entries").insert(recaudo) : { error: null },
  ])
  const fallo = escrituras.find((r) => r.error)
  if (fallo?.error) return { ok: false, error: explicar(fallo.error.message) }

  refrescar()
  return { ok: true }
}

/**
 * Define, cambia o quita una meta.
 *
 * Una meta en cero no se guarda como cero: se borra. "Sin meta" y "meta de
 * cero" no son lo mismo —la primera no dibuja barra de cumplimiento, la segunda
 * daría siempre 100%— y el dashboard necesita distinguirlas.
 */
export async function setObjective(input: {
  company_id: string
  period_month: string
  metric_code: string
  user_id?: string | null
  target_value: number
}): Promise<Result> {
  const session = await requireSession()
  const supabase = await createClient()

  if (input.target_value <= 0) {
    const query = supabase
      .from("objectives")
      .delete()
      .eq("company_id", input.company_id)
      .eq("period_month", input.period_month)
      .eq("metric_code", input.metric_code)

    const { error } = input.user_id
      ? await query.eq("user_id", input.user_id)
      : await query.is("user_id", null)

    if (error) return { ok: false, error: explicar(error.message) }
    refrescar()
    return { ok: true }
  }

  const { error } = await supabase.from("objectives").upsert(
    {
      company_id: input.company_id,
      period_month: input.period_month,
      metric_code: input.metric_code,
      user_id: input.user_id ?? null,
      target_value: input.target_value,
      created_by: session.profile.id,
      updated_by: session.profile.id,
    },
    { onConflict: "company_id,period_month,metric_code,user_id" },
  )

  if (error) return { ok: false, error: explicar(error.message) }

  refrescar()
  return { ok: true }
}

/** Copia las metas del mes anterior, sin pisar las que ya existan. */
export async function copyObjectivesFromPreviousMonth(
  companyId: string,
  targetMonth: string,
): Promise<Result & { copiadas?: number }> {
  const session = await requireSession()
  const supabase = await createClient()

  const [y, m] = targetMonth.split("-").map(Number)
  const anterior = new Date(Date.UTC(y, m - 2, 1))
  const mesAnterior = `${anterior.getUTCFullYear()}-${String(anterior.getUTCMonth() + 1).padStart(2, "0")}-01`

  const [{ data: origen }, { data: destino }] = await Promise.all([
    supabase
      .from("objectives")
      .select("metric_code, user_id, target_value")
      .eq("company_id", companyId)
      .eq("period_month", mesAnterior),
    supabase
      .from("objectives")
      .select("metric_code, user_id")
      .eq("company_id", companyId)
      .eq("period_month", targetMonth),
  ])

  const yaExiste = new Set((destino ?? []).map((o) => `${o.metric_code}|${o.user_id ?? ""}`))
  const nuevas = (origen ?? [])
    .filter((o) => !yaExiste.has(`${o.metric_code}|${o.user_id ?? ""}`))
    .map((o) => ({
      company_id: companyId,
      period_month: targetMonth,
      metric_code: o.metric_code,
      user_id: o.user_id,
      target_value: o.target_value,
      created_by: session.profile.id,
    }))

  if (nuevas.length === 0) return { ok: true, copiadas: 0 }

  const { error } = await supabase.from("objectives").insert(nuevas)
  if (error) return { ok: false, error: explicar(error.message) }

  refrescar()
  return { ok: true, copiadas: nuevas.length }
}
