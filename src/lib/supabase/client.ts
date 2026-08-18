"use client"

import { createBrowserClient } from "@supabase/ssr"

import type { Database } from "./database.types"

/**
 * Cliente de Supabase para el navegador. Usa la clave publicable, así que todo
 * lo que puede leer o escribir está acotado por las políticas RLS de la base:
 * la interfaz no es la defensa, solo la comodidad.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )
}
