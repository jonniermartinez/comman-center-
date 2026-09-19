import "server-only"

import { PRIORIDADES, type Cola } from "@/lib/agendas"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/database.types"

export type AgendaRow = Database["public"]["Views"]["v_agendas"]["Row"]
export type EventoRow = Database["public"]["Tables"]["appointment_eventos"]["Row"]

/** Tope de una cola de trabajo. Más de esto en un día no se llama; se replantea. */
const TOPE_COLA = 200

/**
 * La cola de trabajo de una de las pestañas.
 *
 * El orden lo decide `prioridad`, que calcula la vista: primero la cita de hoy
 * que nadie validó, después la de hoy que falta marcar, y así. Dentro de cada
 * prioridad manda la hora, porque es el orden en que va a pasar el día.
 *
 * Un comercial ve la suya y quien coordina ve la de todos: eso no se filtra
 * acá, lo hace RLS sobre `appointments`. Poner además un `.eq("staff_id", …)`
 * partiría el criterio en dos sitios que después discrepan.
 */
export async function listarCola(
  companyId: string,
  cola: Exclude<Cola, "historico">,
): Promise<AgendaRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("v_agendas")
    .select("*")
    .eq("company_id", companyId)
    .in("prioridad", PRIORIDADES[cola])
    .order("prioridad", { ascending: true })
    .order("scheduled_at", { ascending: cola !== "seguimiento" })
    .order("scheduled_time", { ascending: true, nullsFirst: false })
    .limit(TOPE_COLA)

  if (error) throw new Error(`v_agendas: ${error.message}`)
  return data ?? []
}

/**
 * Cuántas agendas esperan en cada cola.
 *
 * Es el número de la pestaña, y por eso se cuenta sobre todo lo que hay y no
 * sobre lo que cabe en pantalla: sirve para decidir por dónde empezar el día.
 * Se pide solo el conteo, sin traer las filas.
 */
export async function contarColas(
  companyId: string,
): Promise<Record<Exclude<Cola, "historico">, number>> {
  const supabase = await createClient()

  const conteo = async (prioridades: number[]) => {
    const { count } = await supabase
      .from("v_agendas")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .in("prioridad", prioridades)
    return count ?? 0
  }

  const [hoy, validar, seguimiento] = await Promise.all([
    conteo(PRIORIDADES.hoy),
    conteo(PRIORIDADES.validar),
    conteo(PRIORIDADES.seguimiento),
  ])
  return { hoy, validar, seguimiento }
}

/**
 * El historial de varias agendas de una vez.
 *
 * Se pide para la cola entera y no fila por fila: una pantalla con cuarenta
 * clientes haría cuarenta viajes, y lo que se muestra de cada uno son dos o
 * tres líneas.
 */
export async function historialDe(ids: string[]): Promise<Map<string, EventoRow[]>> {
  if (ids.length === 0) return new Map()

  const supabase = await createClient()
  const { data } = await supabase
    .from("appointment_eventos")
    .select("*")
    .in("appointment_id", ids)
    .order("ocurrido_en", { ascending: false })
    .limit(ids.length * 12)

  const porAgenda = new Map<string, EventoRow[]>()
  for (const evento of data ?? []) {
    const lista = porAgenda.get(evento.appointment_id)
    if (lista) lista.push(evento)
    else porAgenda.set(evento.appointment_id, [evento])
  }
  return porAgenda
}
