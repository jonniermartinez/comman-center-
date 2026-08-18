import "server-only"

import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/database.types"

export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type UserRole = Database["public"]["Enums"]["user_role"]

export interface Assignment {
  company_id: string
  branch_id: string | null
  role: Exclude<UserRole, "super_admin">
}

export interface Session {
  profile: Profile
  assignments: Assignment[]
  /** Activo y con perfil: puede leer datos. Un invitado entra pero no ve nada. */
  isActive: boolean
  isSuperAdmin: boolean
}

/**
 * Quién está en sesión, con su rol y sus empresas, en una sola consulta.
 *
 * Devuelve null si no hay sesión o si el usuario de Auth no tiene perfil (caso
 * raro: alguien creado a mano en Auth antes de que el trigger existiera).
 */
export async function getSession(): Promise<Session | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase.rpc("me")
  const payload = data as { profile: Profile; assignments?: Assignment[]; companies?: Assignment[] } | null
  if (!payload?.profile) return null

  const profile = payload.profile
  return {
    profile,
    assignments: payload.companies ?? payload.assignments ?? [],
    isActive: profile.status === "activo" && !profile.deleted_at,
    isSuperAdmin:
      profile.role === "super_admin" && profile.status === "activo" && !profile.deleted_at,
  }
}

/**
 * Igual que getSession pero manda al login si no hay sesión.
 *
 * El caso raro —sesión de Auth válida pero sin fila en `profiles`— también cae
 * acá, y por eso el login lleva `error`: sin ese marcador el proxy devolvería
 * al usuario a la app y quedaría rebotando entre las dos pantallas.
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession()
  if (!session) redirect("/login?error=sin-perfil")
  return session
}

/**
 * Guarda de las acciones de administración.
 *
 * Es imprescindible antes de cualquier uso del cliente `service_role`, que
 * salta RLS: sin esta verificación, un asesor podría invitar usuarios llamando
 * a la Server Action directamente.
 */
export async function requireSuperAdmin(): Promise<Session> {
  const session = await requireSession()
  if (!session.isSuperAdmin) {
    throw new Error("Solo el super admin puede hacer esto.")
  }
  return session
}
