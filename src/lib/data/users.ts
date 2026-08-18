import "server-only"

import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/database.types"

export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type UserRole = Database["public"]["Enums"]["user_role"]
export type UserStatus = Database["public"]["Enums"]["user_status"]

export interface UserRow extends Profile {
  /** Empresas donde está asignado hoy, con su rol y sede en cada una. */
  companies: { company_id: string; company_name: string; role: string; branch_name: string | null }[]
  /** Registros históricos a su nombre. Es lo que se conserva si se elimina. */
  registros: number
}

/**
 * Usuarios visibles para quien consulta. No hace falta filtrar por rol acá:
 * la política `profiles_select` ya devuelve solo el propio perfil y el de la
 * gente con la que se comparte empresa; el super admin ve todos.
 */
export async function listUsers(): Promise<UserRow[]> {
  const supabase = await createClient()

  const [{ data: profiles }, { data: asignaciones }, { data: actividad }] = await Promise.all([
    supabase.from("profiles").select("*").order("full_name"),
    supabase
      .from("company_users")
      .select("user_id, role, company_id, companies(name), branches(name)")
      .is("removed_at", null),
    supabase.from("v_user_activity").select("user_id, registros"),
  ])

  const registrosPorUsuario = new Map(
    (actividad ?? []).map((a) => [a.user_id as string, Number(a.registros ?? 0)]),
  )

  return (profiles ?? []).map((profile) => ({
    ...profile,
    registros: registrosPorUsuario.get(profile.id) ?? 0,
    companies: (asignaciones ?? [])
      .filter((a) => a.user_id === profile.id)
      .map((a) => ({
        company_id: a.company_id,
        company_name: a.companies?.name ?? "—",
        role: a.role,
        branch_name: a.branches?.name ?? null,
      })),
  }))
}

/** Empresas activas, para el selector de asignaciones. */
export async function listActiveCompanies() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("companies")
    .select("id, name, slug")
    .eq("status", "activa")
    .order("name")
  return data ?? []
}
