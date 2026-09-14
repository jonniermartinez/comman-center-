import { LoginForm } from "./login-form"
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

 */
const ERRORES: Record<string, string> = {
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
          Con tu correo y tu contraseña. Si no tienes cuenta o la olvidaste, pídesela al
          administrador.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
      </CardContent>
    </Card>
  )
}
