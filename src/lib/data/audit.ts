import "server-only"

import { createClient } from "@/lib/supabase/server"

/**
 * Deja rastro de una acción administrativa.
 *
 * Va por la función `log_audit` de Postgres, con la sesión del usuario y la
 * clave publicable: `audit_log` solo tiene política de lectura —y solo para el
 * super admin—, así que nadie puede insertar ni alterar el log desde el
 * cliente, y la aplicación no necesita saltarse RLS para escribirlo.
 *
 * Quién firma la acción lo decide Postgres a partir de `auth.uid()`, no quien
 * llama: el actor no se puede falsificar aunque alguien invoque la Server
 * Action por fuera de la interfaz.
 */
export async function logAudit(entry: {
  action: string
  entity: string
  entity_id?: string
  company_id?: string | null
  before?: unknown
  after?: unknown
}) {
  // La auditoría no debe tumbar la operación que la generó: la escritura ya
  // está hecha en la base, y responder con error dejaría a la pantalla sin
  // confirmar algo que sí ocurrió.
  try {
    const supabase = await createClient()
    const { error } = await supabase.rpc("log_audit", {
      p_action: entry.action,
      p_entity: entry.entity,
      p_entity_id: entry.entity_id ?? undefined,
      p_company_id: entry.company_id ?? undefined,
      p_before: (entry.before ?? null) as never,
      p_after: (entry.after ?? null) as never,
    })
    if (error) console.error("audit_log:", error.message)
  } catch (e) {
    console.error("audit_log:", e instanceof Error ? e.message : e)
  }
}
