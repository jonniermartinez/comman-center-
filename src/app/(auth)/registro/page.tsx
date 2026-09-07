import Link from "next/link"

import { SignupForm } from "./signup-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

/**
 * Alta pública. La cuenta nace como asesor sin empresas: entra y ve la
 * aplicación vacía hasta que el super admin la asigne a una.
 */
export default function RegistroPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Crear cuenta</CardTitle>
        <CardDescription>Te llega un código al correo para confirmarla.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SignupForm />
        <p className="text-center text-xs text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="underline underline-offset-4 hover:text-foreground">
            Entrar
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
