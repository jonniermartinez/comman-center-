"use client"

import { ArrowLeft, Ban } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"

import { NoAccess } from "@/components/no-access"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useCompanyBySlug, useCurrentUser, useDb } from "@/lib/store/hooks"
import type { Company } from "@/lib/store/types"

/** La empresa activa de la URL, ya validada por CompanyGuard. */
export function useActiveCompany(): Company {
  const params = useParams<{ slug: string }>()
  const company = useCompanyBySlug(params.slug)
  if (!company) throw new Error("CompanyGuard debe envolver esta página")
  return company
}

/**
 * Verifica que la empresa exista y que el usuario tenga acceso.
 * Es la contraparte en UI de las políticas RLS de 003_rls.sql.
 */
export function CompanyGuard({ children }: { children: React.ReactNode }) {
  const params = useParams<{ slug: string }>()
  const db = useDb()
  const me = useCurrentUser()
  const company = useCompanyBySlug(params.slug)

  if (!company) {
    return (
      <Alert variant="destructive">
        <Ban />
        <AlertTitle>Empresa no encontrada</AlertTitle>
        <AlertDescription className="flex-col items-start gap-3">
          <span>No existe una empresa con la dirección /e/{params.slug}.</span>
          <Button asChild size="sm" variant="outline">
            <Link href="/empresas">
              <ArrowLeft className="size-4" />
              Volver a empresas
            </Link>
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const tieneAcceso =
    me.role === "super_admin" ||
    db.company_users.some(
      (cu) => cu.company_id === company.id && cu.user_id === me.id && !cu.removed_at,
    )

  if (!tieneAcceso) {
    // Si no tiene NINGUNA empresa, la pantalla de sin acceso explica el estado
    // completo. Si tiene otras, basta con decirle que esta no es suya.
    const tieneAlguna = db.company_users.some(
      (cu) => cu.user_id === me.id && !cu.removed_at,
    )
    if (!tieneAlguna) return <NoAccess />

    return (
      <Alert variant="destructive">
        <Ban />
        <AlertTitle>Sin acceso a {company.name}</AlertTitle>
        <AlertDescription className="flex-col items-start gap-3">
          <span>
            {me.full_name} no está asignado a esta empresa. Entrar por la dirección directa no
            da acceso: la base de datos tampoco devolvería sus datos.
          </span>
          <Button asChild size="sm" variant="outline">
            <Link href="/empresas">
              <ArrowLeft className="size-4" />
              Ver mis empresas
            </Link>
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return <>{children}</>
}

/** Bloquea una página cuyo módulo no está habilitado para la empresa. */
export function ModuleGuard({
  module,
  children,
}: {
  module: string
  children: React.ReactNode
}) {
  const db = useDb()
  const company = useActiveCompany()
  const enabled = db.company_modules.some(
    (m) => m.company_id === company.id && m.module_code === module,
  )

  if (!enabled) {
    return (
      <Alert>
        <Ban />
        <AlertTitle>Módulo no habilitado</AlertTitle>
        <AlertDescription className="flex-col items-start gap-3">
          <span>
            {company.name} no tiene este módulo activo. Se habilita desde la configuración de la
            empresa.
          </span>
          <Button asChild size="sm" variant="outline">
            <Link href={`/e/${company.slug}/configuracion`}>Ir a configuración</Link>
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return <>{children}</>
}
