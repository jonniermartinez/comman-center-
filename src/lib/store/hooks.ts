"use client"

import { useSyncExternalStore } from "react"

import { todayISO } from "@/lib/format"
import { getServerSnapshot, getSnapshot, subscribe } from "./db"
import { REFERENCE_DATE } from "./seed"
import type { Branch, Company, Database, ModuleCode, Profile, UserRole } from "./types"

/** Suscripción a toda la base. Cualquier acción re-renderiza lo suscrito. */
export function useDb(): Database {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function useCurrentUser(): Profile {
  const db = useDb()
  return (
    db.profiles.find((p) => p.id === db.current_user_id) ?? {
      id: "desconocido",
      full_name: "Sin sesión",
      email: "",
      role: "asesor",
      status: "inactivo",
      created_at: new Date(0).toISOString(),
    }
  )
}

export function useIsSuperAdmin(): boolean {
  return useCurrentUser().role === "super_admin"
}

/** Rol efectivo del usuario actual dentro de una empresa. */
export function useCompanyRole(companyId?: string): UserRole | null {
  const db = useDb()
  const me = useCurrentUser()
  if (me.role === "super_admin") return "super_admin"
  if (!companyId) return null
  const cu = db.company_users.find(
    (x) => x.company_id === companyId && x.user_id === me.id && !x.removed_at,
  )
  return cu?.role ?? null
}

/** Puede administrar usuarios, módulos y objetivos de la empresa. */
export function useCanManage(companyId?: string): boolean {
  const role = useCompanyRole(companyId)
  return role === "super_admin" || role === "coordinador"
}

/** Empresas visibles para el usuario actual. El super admin ve todas. */
export function useVisibleCompanies(includeArchived = false): Company[] {
  const db = useDb()
  const me = useCurrentUser()

  const companies =
    me.role === "super_admin"
      ? db.companies
      : db.companies.filter((c) =>
          db.company_users.some(
            (cu) => cu.company_id === c.id && cu.user_id === me.id && !cu.removed_at,
          ),
        )

  return companies
    .filter((c) => includeArchived || c.status === "activa")
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function useCompanyBySlug(slug: string): Company | undefined {
  const db = useDb()
  return db.companies.find((c) => c.slug === slug)
}

export function useCompanyModules(companyId?: string): ModuleCode[] {
  const db = useDb()
  if (!companyId) return []
  return db.company_modules
    .filter((m) => m.company_id === companyId)
    .map((m) => m.module_code)
}

export type Member = Profile & {
  companyRole: Exclude<UserRole, "super_admin">
  branchId: string | null
  branchName: string | null
}

/**
 * Comerciales asignados y activos de una empresa, con su sede.
 * `branchId` filtra a una sede concreta.
 */
export function useCompanyMembers(companyId?: string, branchId?: string | null): Member[] {
  const db = useDb()
  if (!companyId) return []
  return db.company_users
    .filter((cu) => cu.company_id === companyId && !cu.removed_at)
    .filter((cu) => !branchId || cu.branch_id === branchId)
    .map((cu) => {
      const profile = db.profiles.find((p) => p.id === cu.user_id)
      if (!profile) return null
      const branch = db.branches.find((b) => b.id === cu.branch_id)
      return {
        ...profile,
        companyRole: cu.role,
        branchId: cu.branch_id ?? null,
        branchName: branch?.name ?? null,
      }
    })
    .filter((x): x is Member => !!x)
    .sort((a, b) => a.full_name.localeCompare(b.full_name))
}

/** Sedes activas de una empresa. La principal va primero. */
export function useCompanyBranches(companyId?: string, includeArchived = false): Branch[] {
  const db = useDb()
  if (!companyId) return []
  return db.branches
    .filter((b) => b.company_id === companyId)
    .filter((b) => includeArchived || b.status === "activa")
    .slice()
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.name.localeCompare(b.name))
}

/** Sede a la que pertenece el usuario actual en una empresa; null si supervisa toda. */
export function useMyBranch(companyId?: string): string | null {
  const db = useDb()
  const me = useCurrentUser()
  if (!companyId) return null
  const cu = db.company_users.find(
    (x) => x.company_id === companyId && x.user_id === me.id && !x.removed_at,
  )
  return cu?.branch_id ?? null
}

/** Catálogo activo (financiaciones o medios de recaudo) de una empresa, ordenado. */
export function useCompanyCatalog(companyId: string | undefined, kind: "financing" | "payment") {
  const db = useDb()
  if (!companyId) return []
  const catalog = kind === "financing" ? db.financing_types : db.payment_methods
  const enabled = kind === "financing" ? db.company_financing_types : db.company_payment_methods
  return catalog
    .filter((c) => enabled.some((e) => e.company_id === companyId && e.code === c.code && e.active))
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
}

/**
 * Fecha de trabajo. Mientras los datos son de demo, cae a la fecha del Excel
 * (15/08/2026) para que los dashboards no salgan vacíos. Con datos reales
 * devuelve siempre la fecha del sistema.
 */
export function useEffectiveToday(): string {
  const db = useDb()
  const today = todayISO()
  return db.daily_kpi.some((k) => k.report_date === today) ? today : REFERENCE_DATE
}

/**
 * Nombre para mostrar. Un usuario eliminado sigue apareciendo en el histórico,
 * marcado, y no se puede seleccionar para registros nuevos.
 */
export function displayName(profile: Profile | undefined, fallback = "—"): string {
  if (!profile) return fallback
  return profile.deleted_at ? `${profile.full_name} (eliminado)` : profile.full_name
}
