import Link from "next/link"

import { LoginForm } from "./login-form"
import { SessionBounce } from "./session-bounce"
import { signOut } from "@/lib/auth/actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

/**
 * Lo que se le dice a quien no pudo entrar.
 *
 * `sin-perfil` es deliberadamente vago. El caso real es que la cuenta existe en
 * el sistema de acceso pero le falta el perfil, y decirlo así le confirmaba a
 * cualquiera —incluido quien esté probando correos ajenos— que esa dirección
 * tiene cuenta. El detalle no le sirve a la persona, que no puede arreglarlo
 * ella misma, y sí a quien esté buscando quién trabaja aquí.
 *
 * Los de enlace sí concretan: no revelan si la cuenta existe, y saber si el
 * enlace caducó o ya se usó es justo lo que necesita para saber que tiene que
 * pedir otro.
 */
const ERRORES: Record<string, string> = {
  "enlace-invalido": "El enlace no es válido. Pide una invitación nueva.",
  "enlace-expirado": "El enlace ya se usó o caducó. Pide uno nuevo.",
  "sin-perfil": "No se pudo entrar. Si el problema sigue, pídele acceso al administrador.",
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
                    Empezar de nuevo
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
