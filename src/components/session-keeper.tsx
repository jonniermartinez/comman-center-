"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { createClient } from "@/lib/supabase/client"

/**
 * Mantiene viva la sesión desde el navegador.
 *
 * Normalmente esto lo haría el proxy (el antiguo middleware), pero en Next 16
 * el proxy solo corre en Node y OpenNext no lo soporta en Cloudflare: el build
 * falla con "Node.js middleware is not currently supported".
 *
 * El cliente de navegador de @supabase/ssr guarda la sesión en cookies y renueva
 * el token antes de que caduque, así que basta con tenerlo montado para que el
 * servidor siga viendo una cookie válida. Cuando el token se renueva o la sesión
 * se cierra, se refresca la ruta para que los Server Components vuelvan a leer
 * con el token nuevo.
 */
export function SessionKeeper() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((evento) => {
      // INITIAL_SESSION se dispara en cada montaje: refrescar ahí sería un bucle.
      if (evento === "TOKEN_REFRESHED" || evento === "SIGNED_OUT" || evento === "SIGNED_IN") {
        router.refresh()
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  return null
}
