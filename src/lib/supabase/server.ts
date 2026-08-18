import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import type { Database } from "./database.types"

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 *
 * Se crea uno por petición: el cliente guarda la sesión del usuario, así que
 * compartirlo entre peticiones mezclaría sesiones de usuarios distintos.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Un Server Component no puede escribir cookies. No es un problema:
            // el proxy ya refrescó la sesión antes de llegar hasta acá.
          }
        },
      },
    },
  )
}
