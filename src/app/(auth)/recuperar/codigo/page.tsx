import Link from "next/link"
import { redirect } from "next/navigation"

import { VerifyForm } from "@/app/(auth)/verificar/verify-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

/**
 * Segundo paso de "olvidé mi contraseña" y de la cuenta que crea el super
 * admin: el código de seis dígitos que llegó al correo. Al canjearlo se abre
 * sesión y se va a definir la contraseña.
 */
export default async function RecuperarCodigoPage({ searchParams }: PageProps<"/recuperar/codigo">) {
  const { email } = await searchParams
  if (typeof email !== "string" || !email) redirect("/recuperar")

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revisa tu correo</CardTitle>
        <CardDescription>
          Si <span className="font-medium text-foreground">{email}</span> tiene cuenta, le llegó
          un código. Escríbelo aquí o abre el enlace del correo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <VerifyForm email={email} tipo="recovery" />
        <p className="text-center text-xs text-muted-foreground">
          <Link href="/login" className="underline underline-offset-4 hover:text-foreground">
            Volver a entrar
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
