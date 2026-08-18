import "server-only"

import { createClient as createSupabaseClient } from "@supabase/supabase-js"

import type { Database } from "./database.types"

/**
 * Cliente con la clave `service_role`. **Salta RLS por completo.**
 *
 * Solo se usa para lo que la Admin API de Auth exige y ninguna política puede
 * hacer: invitar a un usuario, revocarle el acceso o reactivarlo. Cada uso va
 * precedido de una verificación explícita de que quien lo pide es super admin
 * (ver `src/lib/auth/guard.ts`): con esta clave la base no pregunta nada.
 *
 * Nunca debe importarse desde un componente de cliente. `server-only` hace que
 * el build falle si eso llega a pasar.
 */
/** ¿Está configurada la clave de servicio? Sin ella no se puede tocar Auth. */
export function hasAdminKey(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY. Se copia de Supabase → Project Settings → API Keys → service_role.",
    )
  }

  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
