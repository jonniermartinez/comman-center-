import "server-only"

import { hoyEnBogota } from "@/lib/mi-jornada"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/database.types"

export type JornadaResumen = Database["public"]["Views"]["v_jornada_resumen"]["Row"]
export type JornadaEvento = Database["public"]["Tables"]["jornada_eventos"]["Row"]

/** Cuántas gestiones se enseñan debajo del panel. Más abajo no mira nadie. */
const ULTIMAS = 12

export interface MiJornada {
  resumen: JornadaResumen
  eventos: JornadaEvento[]
  /** La cola del CRM de hoy, para saber qué momentos faltan por registrar. */
  crm: {
    chats_inicial: number
    chats_medio: number
    chats_final: number
    tareas_inicial: number
    tareas_medio: number
    tareas_final: number
    caducadas_inicial: number
    caducadas_medio: number
    caducadas_final: number
  } | null
}

/**
 * La jornada de hoy de una persona, si la abrió.
 *
 * Devuelve null cuando todavía no ha empezado: esa es la diferencia entre la
 * pantalla que ofrece el botón de iniciar y la que ya es la herramienta de
 * trabajo, y conviene que sea una pregunta sola y no tres.
 */
export async function miJornadaDeHoy(
  companyId: string,
  staffId: string,
): Promise<MiJornada | null> {
  const supabase = await createClient()
  const hoy = hoyEnBogota()

  const { data: resumen } = await supabase
    .from("v_jornada_resumen")
    .select("*")
    .eq("company_id", companyId)
    .eq("staff_id", staffId)
    .eq("report_date", hoy)
    .maybeSingle()

  if (!resumen?.id) return null

  const [eventos, crm] = await Promise.all([
    supabase
      .from("jornada_eventos")
      .select("*")
      .eq("jornada_id", resumen.id)
      .order("fin", { ascending: false })
      .limit(ULTIMAS),
    supabase
      .from("daily_activity")
      .select(
        "chats_inicial, chats_medio, chats_final, tareas_inicial, tareas_medio, tareas_final, caducadas_inicial, caducadas_medio, caducadas_final",
      )
      .eq("company_id", companyId)
      .eq("staff_id", staffId)
      .eq("report_date", hoy)
      .maybeSingle(),
  ])

  return { resumen, eventos: eventos.data ?? [], crm: crm.data ?? null }
}

/**
 * Las últimas jornadas cerradas de una persona.
 *
 * Es el historial que en el Excel no existía: cuánto se trabajó cada día y
 * cuánto de eso fue efectivo.
 */
export async function misJornadas(
  companyId: string,
  staffId: string,
  limite = 15,
): Promise<JornadaResumen[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("v_jornada_resumen")
    .select("*")
    .eq("company_id", companyId)
    .eq("staff_id", staffId)
    .order("report_date", { ascending: false })
    .limit(limite)
  return data ?? []
}
