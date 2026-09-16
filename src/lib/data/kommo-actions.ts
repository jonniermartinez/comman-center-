"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

import { requireSession } from "@/lib/auth/session"
import { logAudit } from "@/lib/data/audit"
import {
  esDireccionPublica,
  finDelDia,
  inicioDelDia,
  queryKommo,
  type ConfigKommo,
  type EstructuraKommo,
  type KommoTarea,
} from "@/lib/kommo"
import { createClient } from "@/lib/supabase/server"

export interface Result {
  ok: boolean
  error?: string
}

type Supabase = Awaited<ReturnType<typeof createClient>>

function refrescar() {
  revalidatePath("/", "layout")
}

/** Kommo permite 7 peticiones por segundo; con esto no se llega ni a la mitad. */
const PAUSA_MS = 200
/** Tope de páginas por consulta (250 por página). Evita recorrer una cuenta entera sin querer. */
const MAX_PAGINAS = 40

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

class ErrorKommo extends Error {}

function explicarEstado(status: number, cuerpo: unknown): string {
  if (status === 401) return "Kommo rechazó el token: puede estar vencido o revocado."
  if (status === 402) return "La cuenta de Kommo no tiene un plan activo."
  if (status === 403) return "Kommo bloqueó el acceso (demasiadas peticiones o permisos insuficientes)."
  if (status === 404) return "No se encontró la cuenta de Kommo: revisa el subdominio."
  const detalle =
    cuerpo && typeof cuerpo === "object" && "title" in cuerpo ? ` (${String(cuerpo.title)})` : ""
  return `Kommo respondió ${status}${detalle}.`
}

function explicar(mensaje: string): string {
  if (mensaje.includes("canceling statement due to statement timeout"))
    return "Kommo tardó demasiado en responder. Intenta con un rango de fechas más corto."
  if (mensaje.includes("Timeout was reached") || mensaje.includes("Could not resolve host"))
    return "No se pudo contactar a Kommo. Revisa el subdominio o intenta de nuevo."
  return mensaje
}

/** Una llamada a Kommo a través de la base. Reintenta una vez si Kommo pide calma (429). */
async function kommoGet(
  supabase: Supabase,
  companyId: string,
  path: string,
  query: string,
): Promise<unknown> {
  for (let intento = 0; intento < 2; intento++) {
    const { data, error } = await supabase.rpc("kommo_get", {
      p_company: companyId,
      p_path: path,
      p_query: query,
    })
    if (error) throw new ErrorKommo(explicar(error.message))

    const { status, body } = data as { status: number; body: unknown }
    if (status === 204) return null
    if (status === 200) return body
    if (status === 429 && intento === 0) {
      await esperar(1500)
      continue
    }
    throw new ErrorKommo(explicarEstado(status, body))
  }
  return null
}

/** Recorre las páginas de un listado y devuelve todos sus elementos. */
async function paginar<T>(
  supabase: Supabase,
  companyId: string,
  path: string,
  params: [string, string | number][],
  clave: string,
): Promise<T[]> {
  const todos: T[] = []
  for (let page = 1; page <= MAX_PAGINAS; page++) {
    const body = (await kommoGet(
      supabase,
      companyId,
      path,
      queryKommo([...params, ["limit", 250], ["page", page]]),
    )) as { _embedded?: Record<string, T[]>; _links?: { next?: unknown } } | null
    if (!body) break
    todos.push(...(body._embedded?.[clave] ?? []))
    if (!body._links?.next) break
    await esperar(PAUSA_MS)
  }
  return todos
}

/**
 * Conecta (o reemplaza) la cuenta de Kommo de una empresa.
 *
 * Después de guardarlo se prueba contra Kommo: si el subdominio o el token están mal, conviene saberlo
 * ahora y no en la primera sincronización.
 */
export async function conectarKommo(input: {
  company_id: string
  subdomain: string
  token: string
}): Promise<Result & { cuenta?: string }> {
  await requireSession()
  const supabase = await createClient()

  // Se acepta también la URL completa: "https://miempresa.kommo.com/leads/".
  const subdominio = input.subdomain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\.kommo\.com.*$/, "")
    .replace(/\/.*$/, "")

  const { error } = await supabase.rpc("kommo_conectar", {
    p_company: input.company_id,
    p_subdomain: subdominio,
    p_token: input.token,
  })
  if (error) return { ok: false, error: error.message }

  await logAudit({
    action: "update",
    entity: "kommo_integrations",
    entity_id: input.company_id,
    company_id: input.company_id,
    // El token no va a la auditoría, ni siquiera parcial.
    after: { subdomain: subdominio },
  })

  refrescar()

  try {
    const cuenta = (await kommoGet(supabase, input.company_id, "/api/v4/account", "")) as {
      name?: string
    } | null
    return { ok: true, cuenta: cuenta?.name }
  } catch (e) {
    return {
      ok: false,
      error: `Se guardó, pero la prueba falló: ${e instanceof Error ? e.message : String(e)}`,
    }
  }
}

export async function desconectarKommo(companyId: string): Promise<Result> {
  await requireSession()
  const supabase = await createClient()

  const { error } = await supabase.rpc("kommo_desconectar", { p_company: companyId })
  if (error) return { ok: false, error: error.message }

  await logAudit({
    action: "delete",
    entity: "kommo_integrations",
    entity_id: companyId,
    company_id: companyId,
  })

  refrescar()
  return { ok: true }
}

/** Lee de Kommo lo necesario para configurar: tipos de tarea y usuarios. */
export async function leerEstructuraKommo(
  companyId: string,
): Promise<Result & { estructura?: EstructuraKommo }> {
  await requireSession()
  const supabase = await createClient()

  try {
    const cuenta = (await kommoGet(supabase, companyId, "/api/v4/account", "with=task_types")) as {
      name: string
      _embedded?: { task_types?: { id: number; name: string }[] }
    }
    await esperar(PAUSA_MS)
    const usuarios = await paginar<{ id: number; name: string }>(
      supabase,
      companyId,
      "/api/v4/users",
      [],
      "users",
    )

    return {
      ok: true,
      estructura: {
        cuenta: cuenta?.name ?? "",
        tiposTarea: cuenta?._embedded?.task_types ?? [],
        usuarios: usuarios.map((u) => ({ id: u.id, name: u.name })),
      },
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function guardarConfigKommo(companyId: string, config: ConfigKommo): Promise<Result> {
  await requireSession()
  const supabase = await createClient()

  const { error } = await supabase.rpc("kommo_configurar", {
    p_company: companyId,
    p_config: { ...config, modo: "tarea" } as never,
  })
  if (error) return { ok: false, error: error.message }

  refrescar()
  return { ok: true }
}

/**
 * Trae de Kommo las tareas de un rango de fechas: lo que había antes del
 * webhook, o lo que se perdió si estuvo caído.
 *
 * Cada tarea se reconoce por su id (`tarea:<id>`), así que repetirlo o
 * cruzarlo con lo que ya llegó por webhook no duplica. Responsable, sede y
 * resultado los decide la base; nombre y celular los completa pg_cron.
 */
export async function sincronizarKommo(input: {
  company_id: string
  desde: string
  hasta: string
}): Promise<Result & { guardadas?: number }> {
  await requireSession()
  const supabase = await createClient()
  const companyId = input.company_id

  if (input.desde > input.hasta) return { ok: false, error: "El rango de fechas está al revés." }

  const { data: integ } = await supabase
    .from("kommo_integrations")
    .select("config")
    .eq("company_id", companyId)
    .maybeSingle()
  if (!integ) return { ok: false, error: "Esta empresa no tiene Kommo conectado." }
  const config = (integ.config ?? {}) as ConfigKommo

  const desdeTs = inicioDelDia(input.desde)
  const hastaTs = finDelDia(input.hasta)

  try {
    // La API no filtra por fecha de la tarea, solo por última edición. Una
    // tarea para el día X se tocó por última vez en X o antes, así que se pide
    // lo editado desde un margen antes del rango y se filtra acá.
    const tareas = (
      await paginar<KommoTarea>(
        supabase,
        companyId,
        "/api/v4/tasks",
        [
          ...(config.tipo_tarea_id
            ? ([["filter[task_type][]", config.tipo_tarea_id]] as [string, number][])
            : []),
          ["filter[updated_at][from]", desdeTs - 90 * 86400],
        ],
        "tasks",
      )
    ).filter((t) => t.complete_till >= desdeTs && t.complete_till <= hastaTs)

    let guardadas = 0
    for (let i = 0; i < tareas.length; i += 200) {
      const { data, error } = await supabase.rpc("kommo_guardar_tareas", {
        p_company: companyId,
        p_tareas: tareas.slice(i, i + 200) as never,
      })
      if (error) throw new ErrorKommo(error.message)
      guardadas += data ?? 0
    }

    await supabase.rpc("kommo_registrar_sync", {
      p_company: companyId,
      p_count: guardadas,
      // Sin error: la función limpia el último que hubo.
      p_error: null as unknown as string,
    })
    refrescar()
    return { ok: true, guardadas }
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e)
    await supabase.rpc("kommo_registrar_sync", {
      p_company: companyId,
      p_count: 0,
      p_error: mensaje,
    })
    refrescar()
    return { ok: false, error: mensaje }
  }
}

/** La dirección de la aplicación con la que se está navegando. */
async function direccionBase(): Promise<string> {
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? ""
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("192.168.") ? "http" : "https")
  return `${proto}://${host}`.replace(/\/$/, "")
}

/**
 * Deja el webhook puesto en Kommo sin entrar a Kommo.
 *
 * La base genera el secreto, quita los webhooks viejos de Command Center y
 * registra el nuevo con "tarea añadida" y "tarea editada" (050).
 */
export async function instalarWebhookKommo(companyId: string): Promise<Result & { url?: string }> {
  await requireSession()
  const supabase = await createClient()

  const base = await direccionBase()
  if (!esDireccionPublica(base)) {
    return {
      ok: false,
      error: `Estás en ${base}, que es tu computador: Kommo no puede avisarle. Hazlo desde la aplicación publicada.`,
    }
  }

  const { data: url, error } = await supabase.rpc("kommo_instalar_webhook", {
    p_company: companyId,
    p_base_url: base,
  })
  if (error || !url) return { ok: false, error: error?.message ?? "No se pudo instalar." }

  await logAudit({
    action: "update",
    entity: "kommo_integrations",
    entity_id: companyId,
    company_id: companyId,
    after: { webhook: "instalado en Kommo" },
  })

  refrescar()
  return { ok: true, url }
}

/**
 * Genera la dirección para ponerla a mano en Kommo.
 *
 * El secreto se muestra una sola vez; en la base queda su hash. Generar otra
 * dirección deja de aceptar la anterior.
 */
export async function generarWebhookKommo(companyId: string): Promise<Result & { url?: string }> {
  await requireSession()
  const supabase = await createClient()

  const { data: secreto, error } = await supabase.rpc("kommo_generar_webhook", {
    p_company: companyId,
  })
  if (error || !secreto) return { ok: false, error: error?.message ?? "No se pudo generar." }

  await logAudit({
    action: "update",
    entity: "kommo_integrations",
    entity_id: companyId,
    company_id: companyId,
    after: { webhook: "dirección generada" },
  })

  refrescar()
  return { ok: true, url: `${await direccionBase()}/api/kommo/webhook/${secreto}` }
}
