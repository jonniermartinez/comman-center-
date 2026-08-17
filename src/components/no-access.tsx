"use client"

import { Lock, MailCheck, ShieldOff } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { useCurrentUser } from "@/lib/store/hooks"
import { ROLE_LABELS } from "@/lib/store/types"

/**
 * Pantalla de un usuario que existe pero no tiene acceso a nada.
 *
 * Es la contraparte visible de las políticas RLS: un usuario sin empresas
 * asignadas no puede leer ninguna fila de `companies`, `branches`, `daily_kpi`,
 * `sales_entries` ni `profiles` de terceros. Acá no se le muestran datos vacíos
 * ni ceros, porque no es que sus cifras estén en cero: es que no tiene permiso
 * de verlas.
 */
export function NoAccess() {
  const me = useCurrentUser()
  const invitado = me.status === "invitado"
  const inactivo = me.status === "inactivo"

  return (
    <div className="mx-auto max-w-lg py-12 text-center">
      <span
        aria-hidden
        className="mx-auto mb-5 flex size-12 items-center justify-center rounded-xl border bg-card"
      >
        {invitado ? (
          <MailCheck className="size-5 text-muted-foreground" />
        ) : inactivo ? (
          <Lock className="size-5 text-muted-foreground" />
        ) : (
          <ShieldOff className="size-5 text-muted-foreground" />
        )}
      </span>

      <h1 className="text-lg font-semibold tracking-tight">
        {invitado
          ? "Tu cuenta está pendiente de activación"
          : inactivo
            ? "Tu acceso está suspendido"
            : "Todavía no tienes acceso a ninguna empresa"}
      </h1>

      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {invitado ? (
          <>
            Revisa el correo de invitación que se envió a{" "}
            <span className="font-medium text-foreground">{me.email}</span> y define tu
            contraseña. Hasta entonces no puedes ver información del sistema.
          </>
        ) : inactivo ? (
          <>
            Un administrador suspendió tu acceso. Tus registros anteriores se conservan; para
            volver a entrar pídele que reactive tu cuenta.
          </>
        ) : (
          <>
            Tu cuenta existe y está activa, pero no estás asignado a ninguna empresa ni sede.
            Pídele al super admin que te asigne una para empezar a registrar.
          </>
        )}
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs">
        <Badge variant="outline">{me.full_name}</Badge>
        <Badge variant="outline">{ROLE_LABELS[me.role]}</Badge>
        <Badge variant={me.status === "activo" ? "secondary" : "outline"}>
          {me.status === "activo" ? "Activo" : invitado ? "Invitado" : "Inactivo"}
        </Badge>
        <Badge variant="outline">0 empresas</Badge>
      </div>

      <p className="mx-auto mt-6 max-w-md border-t pt-4 text-xs text-muted-foreground">
        Esto no es una pantalla vacía: el sistema no te está ocultando cifras en cero, es que
        los permisos no te dejan leerlas. La misma regla se aplica en la base de datos, no solo
        en la interfaz.
      </p>
    </div>
  )
}
