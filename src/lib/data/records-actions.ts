"use server"

import { revalidatePath } from "next/cache"

import { requireSession } from "@/lib/auth/session"
import { logAudit } from "@/lib/data/audit"
import { createClient } from "@/lib/supabase/server"

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
 * triggers—, así que acá no se repiten: se explican. Repetirlas en el cliente es
 * lo que hace que la app y la base terminen discrepando.
 */
function explicar(mensaje: string): string {
  if (mensaje.includes("fecha futura")) return "No se puede registrar una fecha futura."
  if (mensaje.includes("daily_activity_company_id_branch_id_report_date_staff_id_key"))
    return "Esa persona ya tiene registrada esa fecha."
  // Pasa al editar una jornada y moverla a una fecha o persona que ya tiene la
  // suya: el upsert intenta escribir sobre esa otra fila y choca por la llave.
  if (mensaje.includes("daily_activity_pkey"))
    return "Ya existe otra jornada de esa persona en esa fecha. Edita esa, o cambia la fecha."
  if (mensaje.includes("row-level security") || mensaje.includes("permission denied"))
    return "No tienes permiso para registrar en esta empresa."
  return mensaje
}

/** El primer día del mes al que pertenece una fecha. */
function periodo(fecha: string) {
  return `${fecha.slice(0, 7)}-01`
}

export interface ActividadInput {
  id?: string
  company_id: string
  branch_id: string
  report_date: string
  staff_id: string
  responsable_nombre: string
  hora_llegada?: string | null
  hora_salida?: string | null
  chats_inicial: number
  chats_medio: number
  chats_final: number
  tareas_inicial: number
  tareas_medio: number
  tareas_final: number
  caducadas_inicial: number
  caducadas_medio: number
  caducadas_final: number
  agenda_confirmada: number
  agenda_posible: number
  agenda_reprograma: number
  agenda_no_contesta: number
  agenda_cancela: number
  llamada_no_contestada: number
  llamada_efectiva: number
  llamada_seguimiento: number
  llamada_agenda: number
  llamada_no_interesado: number
  llamada_contestada: number
  llamada_postventa: number
  atencion_venta: number
  atencion_seguimiento: number
  atencion_declinado: number
  atencion_asociado: number
  atencion_enrolamiento: number
  atencion_certificados: number
  atencion_agenda: number
  atencion_renovacion: number
  notas?: string | null
}

/**
 * Guarda la jornada de una persona.
 *
 * Una fila por empresa + sede + fecha + persona: el `upsert` sobre esa
 * combinación hace que volver a guardar el mismo día corrija en vez de
 * duplicar, y la unicidad la garantiza el índice de la base, no una consulta
 * previa que podría quedar desactualizada.
 */
export async function saveActivity(input: ActividadInput): Promise<Result> {
  const session = await requireSession()
  const supabase = await createClient()

  const { id, ...campos } = input
  const { error } = await supabase.from("daily_activity").upsert(
    {
      ...campos,
      id,
      period_month: periodo(input.report_date),
      hora_llegada: input.hora_llegada || null,
      hora_salida: input.hora_salida || null,
      notas: input.notas || null,
      updated_by: session.profile.id,
      created_by: session.profile.id,
    },
    { onConflict: "company_id,branch_id,report_date,staff_id" },
  )

  if (error) return { ok: false, error: explicar(error.message) }

  refrescar()
  return { ok: true }
}

export interface VentaInput {
  id?: string
  company_id: string
  branch_id: string
  report_date: string
  staff_id?: string | null
  responsable_nombre?: string | null
  ref_credito?: string | null
  financing_code?: string | null
  product_code?: string | null
  school_code?: string | null
  state_code?: string | null
  channel_code?: string | null
  licencia_tipo_id?: string | null
  licencia_id?: string | null
  licencia_nombre?: string | null
  licencia_celular?: string | null
  credito_id?: string | null
  credito_nombre?: string | null
  credito_celular?: string | null
  valor_inicial: number
  adicion: number
  descuento: number
  valor_final: number
  recaudo: number
  saldo: number
  cantidad_final: number
  observacion?: string | null
}

export async function saveSale(input: VentaInput): Promise<Result> {
  const session = await requireSession()
  const supabase = await createClient()

  const { error } = await supabase.from("sales").upsert({
    ...input,
    period_month: periodo(input.report_date),
    created_by: session.profile.id,
    updated_by: session.profile.id,
  })

  if (error) return { ok: false, error: explicar(error.message) }

  refrescar()
  return { ok: true }
}

export interface PagoInput {
  id?: string
  company_id: string
  branch_id: string
  report_date: string
  ref_credito?: string | null
  sale_id?: string | null
  titular_id?: string | null
  titular_nombre?: string | null
  amount: number
  method_code?: string | null
  recibo?: string | null
  observacion?: string | null
}

export async function savePayment(input: PagoInput): Promise<Result> {
  const session = await requireSession()
  const supabase = await createClient()

  const { error } = await supabase.from("payments").upsert({
    ...input,
    period_month: periodo(input.report_date),
    created_by: session.profile.id,
    updated_by: session.profile.id,
  })

  if (error) return { ok: false, error: explicar(error.message) }

  refrescar()
  return { ok: true }
}

export interface MovimientoCajaInput {
  id?: string
  company_id: string
  branch_id: string
  report_date: string
  kind: "entrada" | "salida"
  concept_code?: string | null
  method_code?: string | null
  staff_id?: string | null
  responsable_nombre?: string | null
  identificacion?: string | null
  nombre?: string | null
  factura?: string | null
  amount: number
  observacion?: string | null
}

export async function saveCashMovement(input: MovimientoCajaInput): Promise<Result> {
  const session = await requireSession()
  const supabase = await createClient()

  const { error } = await supabase.from("cash_movements").upsert({
    ...input,
    period_month: periodo(input.report_date),
    // Las salidas se guardan en negativo, como vienen del Excel, para que el
    // neto sea una suma y no un condicional repartido por las consultas.
    amount: input.kind === "salida" ? -Math.abs(input.amount) : Math.abs(input.amount),
    created_by: session.profile.id,
    updated_by: session.profile.id,
  })

  if (error) return { ok: false, error: explicar(error.message) }

  refrescar()
  return { ok: true }
}

export interface AgendaInput {
  id?: string
  company_id: string
  branch_id: string
  scheduled_at: string
  scheduled_time?: string | null
  nombre?: string | null
  celular?: string | null
  staff_id?: string | null
  responsable_nombre?: string | null
  resultado?: string | null
  observacion?: string | null
}

export async function saveAppointment(input: AgendaInput): Promise<Result> {
  const session = await requireSession()
  const supabase = await createClient()

  const { error } = await supabase.from("appointments").upsert({
    ...input,
    scheduled_time: input.scheduled_time || null,
    created_by: session.profile.id,
    updated_by: session.profile.id,
  })

  if (error) return { ok: false, error: explicar(error.message) }

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

export interface VentaBuscada {
  id: string
  branch_id: string
  ref_credito: string | null
  cliente: string
  documento: string
  report_date: string
  valor_final: number
  saldo: number
}

/**
 * Busca la venta a la que pertenece un pago.
 *
 * Devuelve el saldo junto con el valor: al registrar un abono, lo primero que
 * se necesita saber es cuánto falta, y tenerlo delante evita el error clásico
 * de abonar sobre el crédito equivocado.
 */
export async function buscarVentas(companyId: string, texto: string): Promise<VentaBuscada[]> {
  await requireSession()
  const termino = texto.trim()
  if (termino.length < 3) return []

  const supabase = await createClient()
  const patron = `%${termino}%`

  const { data } = await supabase
    .from("sales")
    .select(
      "id, branch_id, ref_credito, licencia_nombre, credito_nombre, licencia_id, credito_id, report_date, valor_final, saldo",
    )
    .eq("company_id", companyId)
    .or(
      [
        `licencia_nombre.ilike.${patron}`,
        `credito_nombre.ilike.${patron}`,
        `licencia_id.ilike.${patron}`,
        `credito_id.ilike.${patron}`,
      ].join(","),
    )
    .order("report_date", { ascending: false })
    .limit(15)

  return (data ?? []).map((v) => ({
    id: v.id,
    branch_id: v.branch_id,
    ref_credito: v.ref_credito,
    cliente: v.licencia_nombre ?? v.credito_nombre ?? "—",
    documento: v.licencia_id ?? v.credito_id ?? "",
    report_date: v.report_date,
    valor_final: Number(v.valor_final),
    saldo: Number(v.saldo),
  }))
}

/** Los cinco tipos de registro que el equipo captura a diario. */
export type TipoRegistro = "venta" | "pago" | "jornada" | "agenda" | "movimiento"

const TABLA: Record<
  TipoRegistro,
  "sales" | "payments" | "daily_activity" | "appointments" | "cash_movements"
> = {
  venta: "sales",
  pago: "payments",
  jornada: "daily_activity",
  agenda: "appointments",
  movimiento: "cash_movements",
}

/**
 * Borra un registro de captura.
 *
 * Todo lo que se puede crear se tiene que poder corregir y quitar: hasta ahora
 * la aplicación solo dejaba crear y editar, así que una venta metida por error
 * —o duplicada— se quedaba ahí para siempre falseando el mes.
 *
 * Quién puede hacerlo lo decide la base, no esta función: las políticas de
 * borrado exigen `can_manage_company`, o sea super admin o coordinador. Un
 * asesor puede corregir lo suyo, pero hacer desaparecer un registro es cosa de
 * quien administra.
 *
 * Es borrado de verdad, no marca: son datos operativos del día a día, no el
 * histórico de una empresa. Lo que sí queda es el rastro en la auditoría.
 */
export async function deleteRecord(tipo: TipoRegistro, id: string): Promise<Result> {
  const session = await requireSession()
  const supabase = await createClient()
  const tabla = TABLA[tipo]

  // Se lee antes de borrar para poder dejar en la auditoría qué se llevó por
  // delante: después ya no hay a quién preguntarle.
  const { data: antes } = await supabase.from(tabla).select("*").eq("id", id).maybeSingle()
  if (!antes) return { ok: false, error: "El registro ya no existe." }

  const { error } = await supabase.from(tabla).delete().eq("id", id)
  if (error) return { ok: false, error: explicar(error.message) }

  // Si RLS no dejó borrar, PostgREST no da error: simplemente no toca ninguna
  // fila. Hay que comprobarlo, o la pantalla diría que borró algo que sigue ahí.
  const { data: sigue } = await supabase.from(tabla).select("id").eq("id", id).maybeSingle()
  if (sigue) return { ok: false, error: "No tienes permiso para eliminar este registro." }

  await logAudit({
    action: "delete",
    entity: tabla,
    entity_id: id,
    company_id: (antes as { company_id?: string }).company_id ?? null,
    before: antes,
  })

  refrescar()
  return { ok: true }
}
