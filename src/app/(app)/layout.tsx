import { redirect } from "next/navigation"
import { Suspense } from "react"

import { AppShell } from "@/components/app-shell"
import { SessionKeeper } from "@/components/session-keeper"
import { requireSession } from "@/lib/auth/session"
import { SessionProvider } from "@/lib/auth/session-context"
import { loadSnapshot } from "@/lib/data/snapshot"
import { PeriodoProvider } from "@/lib/store/periodo"
import { mesActivo } from "@/lib/store/periodo-server"
import { BASE_VACIA, RemoteProvider } from "@/lib/store/remote"

/**
 * Puerta de entrada a la app con sesión.
 *
 * Acá se resuelve quién es el usuario y qué puede ver, en el servidor. Las
 * pantallas de adentro consumen ese resultado; ninguna vuelve a preguntar por
 * la sesión ni decide permisos por su cuenta.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession()

  // Un invitado que aún no definió contraseña no tiene nada que hacer adentro:
  // RLS le negaría hasta los catálogos. Se le manda a completar el alta.
  if (session.profile.status === "invitado") redirect("/definir-clave")

  // Suspendido o eliminado: no se consulta nada, no se muestran ceros.
  const snapshot = session.isActive ? await loadSnapshot() : BASE_VACIA
  // El mes elegido se resuelve acá, en el servidor, para que el primer render
  // del cliente coincida con el suyo y no haya salto de hidratación.
  const mes = await mesActivo()

  return (
    <SessionProvider
      value={{
        profile: {
          id: session.profile.id,
          full_name: session.profile.full_name,
          email: session.profile.email,
          phone: session.profile.phone ?? undefined,
          role: session.profile.role,
          status: session.profile.status,
          deleted_at: session.profile.deleted_at,
          created_at: session.profile.created_at,
        },
        isSuperAdmin: session.isSuperAdmin,
        isActive: session.isActive,
      }}
    >
      <RemoteProvider value={snapshot}>
        <SessionKeeper />
        <Suspense>
          <PeriodoProvider mesInicial={mes}>
            <AppShell>{children}</AppShell>
          </PeriodoProvider>
        </Suspense>
      </RemoteProvider>
    </SessionProvider>
  )
}
