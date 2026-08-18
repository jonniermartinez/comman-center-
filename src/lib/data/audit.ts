import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Deja rastro de una acción administrativa.
 *
 * Se escribe con la clave de servicio a propósito: `audit_log` solo tiene
 * política de lectura (y solo para el super admin). Nadie, ni siquiera él,
 * puede insertar ni alterar el log desde el cliente.
 */
export async function logAudit(entry: {
  actor_id: string
  actor_name: string
  action: string
  entity: string
  entity_id?: string
  company_id?: string | null
  before?: unknown
  after?: unknown
}) {
  const admin = createAdminClient()
  const { error } = await admin.from("audit_log").insert({
    actor_id: entry.actor_id,
    actor_name: entry.actor_name,
    action: entry.action,
    entity: entry.entity,
    entity_id: entry.entity_id ?? null,
    company_id: entry.company_id ?? null,
    before: (entry.before ?? null) as never,
    after: (entry.after ?? null) as never,
  })
  // La auditoría no debe tumbar la operación que la generó.
  if (error) console.error("audit_log:", error.message)
}
