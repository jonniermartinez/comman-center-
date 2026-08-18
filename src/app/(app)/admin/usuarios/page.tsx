import { Info } from "lucide-react"

import { UsuariosClient } from "./usuarios-client"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { requireSession } from "@/lib/auth/session"
import { listActiveCompanies, listUsers } from "@/lib/data/users"

/**
 * Alta y baja de cuentas. Solo el super admin.
 *
 * La comprobación se hace acá y además en cada Server Action: esconder el botón
 * no impide que alguien invoque la acción directamente.
 */
export default async function AdminUsuariosPage() {
  const session = await requireSession()

  if (!session.isSuperAdmin) {
    return (
      <Alert>
        <Info />
        <AlertDescription>
          La gestión de cuentas es exclusiva del super admin.
        </AlertDescription>
      </Alert>
    )
  }

  const [users, companies] = await Promise.all([listUsers(), listActiveCompanies()])

  return <UsuariosClient users={users} companies={companies} meId={session.profile.id} />
}
