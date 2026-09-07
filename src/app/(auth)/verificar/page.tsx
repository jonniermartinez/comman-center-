import Link from "next/link"
import { redirect } from "next/navigation"

import { VerifyForm } from "./verify-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

/** Segundo paso del registro: el código de seis dígitos que llegó al correo. */
export default async function VerificarPage({ searchParams }: PageProps<"/verificar">) {
  const { email } = await searchParams
  if (typeof email !== "string" || !email) redirect("/registro")

  return (
    <Card>
      <CardHeader>
        <CardTitle>Confirma tu correo</CardTitle>
        <CardDescription>
          Escribe el código que enviamos a{" "}
          <span className="font-medium text-foreground">{email}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <VerifyForm email={email} />
        <p className="text-center text-xs text-muted-foreground">
          <Link href="/registro" className="underline underline-offset-4 hover:text-foreground">
            Usar otro correo
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
