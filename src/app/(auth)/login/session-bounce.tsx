"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { createClient } from "@/lib/supabase/client"

/**
 * Entra solo si la sesión sigue viva.
 *
 * El servidor no puede renovar el token —un Server Component no escribe
 * cookies—, así que a quien vuelve después de una hora le ve la cookie vencida
 * y lo manda al login. Acá el navegador sí puede renovarla con el refresh
 * token: si lo consigue, se entra derecho sin volver a pedir la contraseña.
 */
export function SessionBounce({ next }: { next?: string }) {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(next || "/empresas")
    })
  }, [router, next])

  return null
}
