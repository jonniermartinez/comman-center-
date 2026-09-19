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
 * Las reglas —quién puede gestionar qué, el tope de tres seguimientos, qué
 * transición tiene sentido— viven en las funciones `agenda_*` de la base (051).
 * Acá no se repiten: los mensajes que ya vienen redactados se dejan pasar tal
 * cual, y solo se traduce lo que Postgres dice en su propio idioma.
 */
function explicar(mensaje: string): string {
  if (mensaje.includes("row-level security") || mensaje.includes("permission denied"))
    return "No tienes permiso para gestionar agendas de esta empresa."
  if (mensaje.includes("statement timeout"))
    return "La base tardó demasiado en responder. Intenta otra vez."
  return mensaje
}

/**
 * Deja el resultado de una llamada de validación.
 *
 * Una sola acción para las cinco tipificaciones, igual que hay una sola
 * función en la base. Lo que la pantalla no decide es nada: el estado que
 * queda, el contador de intentos, el historial y la suma en la jornada del día
 * salen de `agenda_llamada`, que es donde se puede garantizar que ocurren las
 * cuatro cosas o ninguna.
 */
export async function registrarLlamada(input: {
  agendaId: string
  companyId: string
  resultado: "no_contesta" | "confirma" | "posible" | "reprograma" | "cancela"
  fecha?: string | null
  nota?: string | null
}): Promise<Result> {
  await requireSession()
  const supabase = await createClient()

  const { error } = await supabase.rpc("agenda_llamada", {
    p_agenda: input.agendaId,
    p_resultado: input.resultado,
    p_fecha: input.fecha || undefined,
    p_nota: input.nota?.trim() || undefined,
  })

  if (error) return { ok: false, error: explicar(error.message) }

  await logAudit({
    action: "agenda.llamada",
    entity: "appointments",
    entity_id: input.agendaId,
    company_id: input.companyId,
    after: { resultado: input.resultado, fecha: input.fecha ?? null },
  })

  refrescar()
  return { ok: true }
}

/**
 * Deja constancia de si el cliente vino y en qué terminó.
 *
 * `descartada` también entra por acá: soltar a un cliente es una decisión del
 * mismo momento —llegó el día, no vino, no vale la pena seguir— y tenerla en
 * otra acción solo la escondería.
 */
export async function registrarAsistencia(input: {
  agendaId: string
  companyId: string
  resultado: "venta" | "seguimiento" | "no_interesado" | "no_asistio" | "descartada"
  nota?: string | null
}): Promise<Result> {
  await requireSession()
  const supabase = await createClient()

  const { error } = await supabase.rpc("agenda_asistencia", {
    p_agenda: input.agendaId,
    p_resultado: input.resultado,
    p_nota: input.nota?.trim() || undefined,
  })

  if (error) return { ok: false, error: explicar(error.message) }

  await logAudit({
    action: "agenda.asistencia",
    entity: "appointments",
    entity_id: input.agendaId,
    company_id: input.companyId,
    after: { resultado: input.resultado },
  })

  refrescar()
  return { ok: true }
}
