import { type EmailOtpType } from "@supabase/supabase-js"
import { redirect } from "next/navigation"
import { type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"

/**
 * Aterrizaje de los enlaces que manda Supabase por correo (invitación y
 * restablecimiento). Canjea el token de un solo uso por una sesión y manda a
 * definir la contraseña.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const next = searchParams.get("next") ?? "/definir-clave"

  if (!token_hash || !type) {
    redirect("/login?error=enlace-invalido")
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ type, token_hash })

  if (error) {
    // Un enlace de invitación caduca; el usuario tiene que pedir otro.
    redirect("/login?error=enlace-expirado")
  }

  redirect(next)
}
