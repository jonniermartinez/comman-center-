"use server"

import { revalidatePath } from "next/cache"

import { requireSession } from "@/lib/auth/session"
import { logAudit } from "@/lib/data/audit"
import type { Categoria, Momento, TipoPausa } from "@/lib/mi-jornada"
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
 * Las reglas —de quién es la jornada, qué tipificación existe, que no se
 * registre en pausa— viven en las funciones `jornada_*` de la base (052) y ya
 * vienen redactadas en español. Acá solo se traduce lo que Postgres dice en su
 * propio idioma.
 */
function explicar(mensaje: string): string {
  if (mensaje.includes("row-level security") || mensaje.includes("permission denied"))
    return "No tienes permiso para registrar en esta empresa."
  if (mensaje.includes("statement timeout"))
    return "La base tardó demasiado en responder. Intenta otra vez."
  return mensaje
}

/** Abre la jornada del día, o devuelve la que ya estaba abierta. */
export async function abrirJornada(input: {
  companyId: string
  branchId: string
  staffId: string
}): Promise<Result & { jornadaId?: string }> {
  await requireSession()
  const supabase = await createClient()

  const { data, error } = await supabase.rpc("jornada_abrir", {
    p_company: input.companyId,
    p_branch: input.branchId,
    p_staff: input.staffId,
  })
  if (error) return { ok: false, error: explicar(error.message) }

  await logAudit({
    action: "jornada.abrir",
    entity: "jornadas",
    entity_id: data ?? undefined,
    company_id: input.companyId,
  })

  refrescar()
  return { ok: true, jornadaId: data ?? undefined }
}

/**
 * Deja registrada una gestión.
 *
 * Una sola acción para llamadas y atenciones, igual que hay una sola función
 * en la base: la pantalla no calcula la duración ni decide en qué contador
 * cae: eso ocurre donde se puede garantizar que el evento, la marca de tiempo
 * y el contador se muevan juntos o no se mueva ninguno.
 */
export async function tipificar(input: {
  jornadaId: string
  companyId: string
  clase: "llamada" | "atencion"
  contestada?: boolean
  categoria: Categoria
  tipificacion?: string | null
}): Promise<Result> {
  await requireSession()
  const supabase = await createClient()

  const { error } = await supabase.rpc("jornada_tipificar", {
    p_jornada: input.jornadaId,
    p_clase: input.clase,
    // Para una atención presencial la base ignora este campo —no se contesta
    // un mostrador—, igual que ignora la tipificación de una llamada que nadie
    // cogió. Se mandan en firme porque el contrato de la función los exige.
    p_contestada: input.clase === "llamada" ? (input.contestada ?? false) : false,
    p_categoria: input.categoria,
    p_tipificacion: input.tipificacion ?? "",
  })
  if (error) return { ok: false, error: explicar(error.message) }

  refrescar()
  return { ok: true }
}

/** Inicia una pausa, o termina la que esté corriendo si `tipo` viene vacío. */
export async function pausar(input: {
  jornadaId: string
  tipo?: TipoPausa | null
}): Promise<Result> {
  await requireSession()
  const supabase = await createClient()

  const { error } = await supabase.rpc("jornada_pausa", {
    p_jornada: input.jornadaId,
    p_tipo: input.tipo ?? undefined,
  })
  if (error) return { ok: false, error: explicar(error.message) }

  refrescar()
  return { ok: true }
}

/** La foto de la cola del CRM en uno de los tres momentos del día. */
export async function registrarCrm(input: {
  jornadaId: string
  momento: Momento
  chats: number
  tareas: number
  caducadas: number
}): Promise<Result> {
  await requireSession()
  const supabase = await createClient()

  const { error } = await supabase.rpc("jornada_crm", {
    p_jornada: input.jornadaId,
    p_momento: input.momento,
    p_chats: input.chats,
    p_tareas: input.tareas,
    p_caducadas: input.caducadas,
  })
  if (error) return { ok: false, error: explicar(error.message) }

  refrescar()
  return { ok: true }
}

/** Cierra la jornada y deja la hora de salida en el resumen del día. */
export async function cerrarJornada(input: {
  jornadaId: string
  companyId: string
}): Promise<Result> {
  await requireSession()
  const supabase = await createClient()

  const { error } = await supabase.rpc("jornada_cerrar", { p_jornada: input.jornadaId })
  if (error) return { ok: false, error: explicar(error.message) }

  await logAudit({
    action: "jornada.cerrar",
    entity: "jornadas",
    entity_id: input.jornadaId,
    company_id: input.companyId,
  })

  refrescar()
  return { ok: true }
}
