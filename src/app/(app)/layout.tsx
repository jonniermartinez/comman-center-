import { redirect } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { requireSession } from "@/lib/auth/session"
import { SessionProvider } from "@/lib/auth/session-context"
import { loadSnapshot } from "@/lib/data/snapshot"
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
        <AppShell>{children}</AppShell>
      </RemoteProvider>
    </SessionProvider>
  )
}
