import { redirect } from "next/navigation"

import { PasswordForm } from "./password-form"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

/**
 * Define la contraseña tras aceptar la invitación. Se llega acá con una sesión
 * ya creada por /auth/confirm: sin sesión no hay nada que definir.
 */
export default async function DefinirClavePage() {
  const supabase = await createClient()
  // Mismo criterio que en el resto del servidor: se verifica el token, no se
  // pide refresco (ver src/lib/auth/session.ts).
  const { data } = await supabase.auth.getClaims()
  const correo = data?.claims?.email

  if (!correo) redirect("/login?error=enlace-expirado")

  return (
    <Card>
      <CardHeader>
        <CardTitle>Define tu contraseña</CardTitle>
        <CardDescription>
          Es la que usarás para entrar. Cuenta: {correo}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PasswordForm />
      </CardContent>
    </Card>
  )
}
