import Link from "next/link"

import { LoginForm } from "./login-form"
import { SessionBounce } from "./session-bounce"
import { signOut } from "@/lib/auth/actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const ERRORES: Record<string, string> = {
  "enlace-invalido": "El enlace no es válido. Pide una invitación nueva.",
  "enlace-expirado": "El enlace ya se usó o caducó. Pide uno nuevo.",
  "sin-perfil":
    "Tu cuenta existe en el sistema de acceso pero no tiene perfil. Pídele al administrador que la vuelva a crear.",
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams
  const mensaje = typeof error === "string" ? ERRORES[error] : undefined

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>
          Las cuentas las crea el administrador. Si no tienes una, pídesela.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error !== "sin-perfil" && <SessionBounce next={typeof next === "string" ? next : undefined} />}
        {mensaje && (
          <Alert variant="destructive">
            <AlertDescription className="flex-col items-start gap-2">
              <span>{mensaje}</span>
              {error === "sin-perfil" && (
                <form action={signOut}>
                  <Button type="submit" size="sm" variant="outline">
                    Cerrar la sesión actual
                  </Button>
                </form>
              )}
            </AlertDescription>
          </Alert>
        )}
        <LoginForm next={typeof next === "string" ? next : undefined} />
        <p className="text-center text-xs text-muted-foreground">
          <Link href="/recuperar" className="underline underline-offset-4 hover:text-foreground">
            Olvidé mi contraseña
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
