"use server"

import { revalidatePath } from "next/cache"

import { requireSession } from "@/lib/auth/session"
import { logAudit } from "@/lib/data/audit"
import { totalesJornada } from "@/lib/jornada"
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
  llamada_postventa: number
  atencion_venta: number
  atencion_venta_externa: number
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
      // Contestadas no se digita: es la suma de las tipificaciones. Se guarda
      // calculada para que la columna siga diciendo la verdad, aunque ninguna
      // vista la lea (044).
      llamada_contestada: totalesJornada(input).llamadas_contestadas,
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

/** Un bono aplicado: se guarda copiado, no por referencia (038). */
export interface BonoAplicado {
  bonus_id?: string | null
  name: string
  amount: number
}

export interface AdicionInput {
  concepto: string
  amount: number
}

/** Una línea de financiación. Una venta mixta trae dos o tres. */
export interface FinanciacionInput {
  financing_code?: string | null
  valor: number
  abono: number
  cuota: number
  titular_tipo_id?: string | null
  titular_id?: string | null
  titular_nombre?: string | null
  titular_celular?: string | null
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
  company_product_id?: string | null
  school_code?: string | null
  state_code?: string | null
  channel_code?: string | null
  ad_category_code?: string | null
  sale_type_code?: string | null
  medical_center_code?: string | null
  consecutivo_examen?: string | null
  pagare?: string | null
  voucher?: string | null
  contrato?: string | null
  traffic_code?: string | null
  licencia_tipo_id?: string | null
  licencia_id?: string | null
  licencia_nombre?: string | null
  licencia_celular?: string | null
  credito_tipo_id?: string | null
  credito_id?: string | null
  credito_nombre?: string | null
  credito_celular?: string | null
  valor_inicial: number
  adicion: number
  descuento: number
  valor_final: number
  /**
   * Ni `recaudo` ni `saldo` se envían desde el formulario: el recaudo es la
   * suma de los pagos de la venta y el saldo se calcula solo (029). Mandarlos
   * acá los pisaría con lo que se digitó en la venta.
   */
  cantidad_final: number
  observacion?: string | null
  /** Bonos autorizados aplicados. Su suma es el descuento. */
  bonos?: BonoAplicado[]
  /** Lo que se le agregó al valor de lista. Su suma es la adición. */
  adiciones?: AdicionInput[]
  /** Detalle de una financiación mixta. Vacío si se pagó por una sola vía. */
  financiaciones?: FinanciacionInput[]
  /** Rutas de las fotos del comprobante ya subidas al bucket. Se agregan, no se reemplazan. */
  adjuntos?: string[]
}

/**
 * Guarda una venta con su detalle.
 *
 * La venta y sus tres listas —bonos, adiciones, financiaciones— se escriben en
 * la misma operación: son la explicación de los valores que quedan en la fila.
 * Las listas se reemplazan enteras en vez de intentar casar línea por línea;
 * son tres o cuatro filas y adivinar cuál corresponde a cuál solo abre la
 * puerta a dejar huérfana la que sobra.
 *
 * Corregir una venta ya guardada solo lo puede hacer el super admin, y eso no
 * lo decide este código: lo niega la política de la tabla (039). Acá se
 * traduce el error para que la pantalla diga algo útil.
 */
export async function saveSale(input: VentaInput): Promise<Result> {
  const session = await requireSession()
  const supabase = await createClient()

  const { bonos = [], adiciones = [], financiaciones = [], adjuntos = [], ...venta } = input

  const { data, error } = await supabase
    .from("sales")
    .upsert({
      ...venta,
      period_month: periodo(input.report_date),
      created_by: session.profile.id,
      updated_by: session.profile.id,
    })
    .select("id")
    .single()

  if (error) {
    // Editar una venta guardada lo niega la política, no este código. El
    // mensaje genérico de permisos no ayudaría: lo que hay que decir es por
    // qué esa venta ya no se toca.
    if (input.id && /row-level security|permission denied/.test(error.message)) {
      return {
        ok: false,
        error:
          "Esta venta ya está registrada y solo la puede corregir el super admin. Pídele el cambio con el número de documento del cliente.",
      }
    }
    return { ok: false, error: explicar(error.message) }
  }

  const saleId = data.id

  if (input.id) {
    // Reemplazo, no mezcla: primero se limpia lo que había.
    for (const tabla of ["sale_bonuses", "sale_additions", "sale_financings"] as const) {
      const { error: limpieza } = await supabase.from(tabla).delete().eq("sale_id", saleId)
      if (limpieza) return { ok: false, error: explicar(limpieza.message) }
    }
  }

  if (bonos.length) {
    const { error: e } = await supabase.from("sale_bonuses").insert(
      bonos.map((b) => ({
        sale_id: saleId,
        company_id: input.company_id,
        bonus_id: b.bonus_id ?? null,
        name: b.name,
        amount: b.amount,
        created_by: session.profile.id,
      })),
    )
    if (e) return { ok: false, error: explicar(e.message) }
  }

  if (adiciones.length) {
    const { error: e } = await supabase.from("sale_additions").insert(
      adiciones.map((a) => ({
        sale_id: saleId,
        company_id: input.company_id,
        concepto: a.concepto,
        amount: a.amount,
        created_by: session.profile.id,
      })),
    )
    if (e) return { ok: false, error: explicar(e.message) }
  }

  if (financiaciones.length) {
    const { error: e } = await supabase.from("sale_financings").insert(
      financiaciones.map((f, i) => ({
        sale_id: saleId,
        company_id: input.company_id,
        financing_code: f.financing_code ?? null,
        valor: f.valor,
        abono: f.abono,
        cuota: f.cuota,
        titular_tipo_id: f.titular_tipo_id ?? null,
        titular_id: f.titular_id ?? null,
        titular_nombre: f.titular_nombre ?? null,
        titular_celular: f.titular_celular ?? null,
        sort_order: i,
        created_by: session.profile.id,
      })),
    )
    if (e) return { ok: false, error: explicar(e.message) }
  }

  // Las fotos del comprobante se agregan a las que ya había: quitar una es
  // corregir la venta, y eso queda para el super admin (044).
  if (adjuntos.length) {
    const { error: e } = await supabase.from("sale_attachments").insert(
      adjuntos.map((path) => ({
        sale_id: saleId,
        company_id: input.company_id,
        path,
        created_by: session.profile.id,
      })),
    )
    if (e) return { ok: false, error: explicar(e.message) }
  }

  refrescar()
  return { ok: true }
}

/** Una foto del comprobante ya guardada, con su URL firmada para verla. */
export interface AdjuntoVenta {
  id: string
  path: string
  url: string | null
}

/**
 * El detalle de una venta ya guardada: bonos, adiciones, financiaciones y
 * fotos del comprobante.
 *
 * Lo necesita el formulario cuando se abre para corregir. No viaja con el
 * listado porque son tres consultas más por fila y en pantalla se ven
 * veinticinco ventas a la vez; acá se piden solo las de la que se está
 * abriendo.
 */
export async function getSaleDetail(saleId: string): Promise<{
  bonos: BonoAplicado[]
  adiciones: AdicionInput[]
  financiaciones: FinanciacionInput[]
  adjuntos: AdjuntoVenta[]
}> {
  await requireSession()
  const supabase = await createClient()

  const [bonos, adiciones, financiaciones, adjuntos] = await Promise.all([
    supabase.from("sale_bonuses").select("bonus_id, name, amount").eq("sale_id", saleId),
    supabase.from("sale_additions").select("concepto, amount").eq("sale_id", saleId),
    supabase
      .from("sale_financings")
      .select("financing_code, valor, abono, cuota, titular_nombre, titular_id")
      .eq("sale_id", saleId)
      .order("sort_order"),
    supabase
      .from("sale_attachments")
      .select("id, path")
      .eq("sale_id", saleId)
      .order("created_at"),
  ])

  const urls = await urlsComprobantes((adjuntos.data ?? []).map((a) => a.path))

  return {
    adjuntos: (adjuntos.data ?? []).map((a) => ({
      id: a.id,
      path: a.path,
      url: urls[a.path] ?? null,
    })),
    bonos: (bonos.data ?? []).map((b) => ({
      bonus_id: b.bonus_id,
      name: b.name,
      amount: Number(b.amount),
    })),
    adiciones: (adiciones.data ?? []).map((a) => ({
      concepto: a.concepto,
      amount: Number(a.amount),
    })),
    financiaciones: (financiaciones.data ?? []).map((f) => ({
      financing_code: f.financing_code,
      valor: Number(f.valor),
      abono: Number(f.abono),
      cuota: Number(f.cuota),
      titular_nombre: f.titular_nombre,
      titular_id: f.titular_id,
    })),
  }
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
  /** Ruta del comprobante en el bucket comprobantes-pago. */
  voucher?: string | null
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
  /** "contado" o el crédito con el que se financió; null si no se registró. */
  financing_code: string | null
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
      "id, branch_id, ref_credito, financing_code, licencia_nombre, credito_nombre, licencia_id, credito_id, report_date, valor_final, saldo",
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
    financing_code: v.financing_code,
    cliente: v.licencia_nombre ?? v.credito_nombre ?? "—",
    documento: v.licencia_id ?? v.credito_id ?? "",
    report_date: v.report_date,
    valor_final: Number(v.valor_final),
    saldo: Number(v.saldo),
  }))
}

const BUCKET_COMPROBANTES = "comprobantes-pago"
const MAX_COMPROBANTE = 5 * 1024 * 1024

/**
 * Sube la foto o el PDF del recibo y devuelve la ruta para guardarla en
 * `payments.voucher`. Se sube antes de guardar el pago: si el pago falla
 * queda un archivo suelto, que es un costo menor que un pago sin respaldo.
 */
export async function uploadPaymentReceipt(
  companyId: string,
  formData: FormData,
  /** Carpeta dentro de la empresa: `pagos` para un abono, `ventas` para el comprobante de una venta. */
  carpeta: "pagos" | "ventas" = "pagos",
): Promise<Result & { path?: string }> {
  await requireSession()
  const archivo = formData.get("file")

  if (!(archivo instanceof File) || archivo.size === 0) {
    return { ok: false, error: "No se recibió ningún archivo." }
  }
  if (archivo.size > MAX_COMPROBANTE) {
    return { ok: false, error: "El comprobante pesa más de 5 MB." }
  }

  const supabase = await createClient()
  const extension = archivo.name.split(".").pop()?.toLowerCase() || "jpg"
  const path = `${companyId}/${carpeta}/${crypto.randomUUID()}.${extension}`

  const { error } = await supabase.storage
    .from(BUCKET_COMPROBANTES)
    .upload(path, archivo, { contentType: archivo.type, upsert: false })

  if (error) return { ok: false, error: `No se pudo subir el comprobante: ${error.message}` }
  return { ok: true, path }
}

/**
 * URLs firmadas (una hora) para ver los comprobantes de una página del
 * listado. El bucket es privado; sin firma no se abren.
 */
export async function urlsComprobantes(paths: string[]): Promise<Record<string, string>> {
  const unicas = [...new Set(paths.filter(Boolean))]
  if (unicas.length === 0) return {}

  const supabase = await createClient()
  const { data } = await supabase.storage.from(BUCKET_COMPROBANTES).createSignedUrls(unicas, 3600)

  const urls: Record<string, string> = {}
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urls[item.path] = item.signedUrl
  }
  return urls
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
 * Quién puede hacerlo lo decide la base, no esta función. Para una jornada,
 * una agenda o un movimiento de caja basta con administrar la empresa, o con
 * que el registro sea propio. Una venta, no: desde la 042 solo la borra el
 * super admin, por lo mismo que solo él la corrige —borrar y volver a crear
 * era la forma de saltarse ese bloqueo—.
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
  if (sigue) {
    // Una venta no es que "no tengas permiso": es que ya está firmada. Decirlo
    // así evita que alguien crea que le falta un rol y ande buscándolo.
    return {
      ok: false,
      error:
        tipo === "venta"
          ? "Esta venta ya está registrada: borrarla solo lo puede hacer el super admin."
          : "No tienes permiso para eliminar este registro.",
    }
  }

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
