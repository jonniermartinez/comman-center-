import "server-only"

import { createClient } from "@/lib/supabase/server"
import { BASE_VACIA } from "@/lib/store/remote"
import type { CompanyStatus, Database, MetricUnit, ModuleCode, UserRole } from "@/lib/store/types"
import type { Tables } from "@/lib/supabase/database.types"

/** Lo que devuelve `snapshot()`: cada lista con las columnas que pedía su select. */
interface Snapshot {
  profiles: Tables<"profiles">[]
  staff: Tables<"staff">[]
  company_staff: Pick<Tables<"company_staff">, "company_id" | "staff_id" | "branch_id">[]
  companies: Tables<"companies">[]
  branches: Tables<"branches">[]
  company_modules: Pick<Tables<"company_modules">, "company_id" | "module_code">[]
  company_users: Pick<
    Tables<"company_users">,
    "company_id" | "user_id" | "branch_id" | "role" | "removed_at" | "puede_editar"
  >[]
  financing_types: Tables<"financing_types">[]
  payment_methods: Tables<"payment_methods">[]
  products: Pick<Tables<"products">, "code" | "name" | "sort_order">[]
  schools: Tables<"schools">[]
  channels: Tables<"channels">[]
  sale_states: Tables<"sale_states">[]
  cash_concepts: Tables<"cash_concepts">[]
  company_financing_types: Pick<Tables<"company_financing_types">, "company_id" | "financing_code" | "active">[]
  company_payment_methods: Pick<Tables<"company_payment_methods">, "company_id" | "method_code" | "active">[]
  metrics: Tables<"metrics">[]
}

/** null → undefined: el modelo de la app usa opcionales, Postgres usa null. */
function opt(value: string | null): string | undefined {
  return value ?? undefined
}

/**
 * Los datos de referencia de la sesión: quién es quién, qué empresas hay, qué
 * sedes, qué catálogos.
 *
 * Deliberadamente **no** trae ventas, pagos ni actividad diaria: son decenas de
 * miles de filas y ninguna pantalla las necesita todas. Cada módulo consulta lo
 * suyo, con sus filtros y su paginación, en el servidor.
 *
 * No lleva filtros por usuario: las políticas RLS ya devuelven únicamente lo
 * que esa sesión puede ver. Si alguien sin empresas asignadas pide esto, recibe
 * listas vacías, que es exactamente lo que debe pasar.
 */
export async function loadSnapshot(): Promise<Database> {
  const supabase = await createClient()

  // Una sola llamada en vez de 17: `snapshot()` arma las mismas listas en la
  // base y corre con los permisos del usuario, así que RLS filtra igual que si
  // fueran selects sueltos (migración 067).
  const { data, error } = await supabase.rpc("snapshot")
  if (error || !data) return BASE_VACIA
  const s = data as unknown as Snapshot

  return {
    profiles: s.profiles.map((p) => ({
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      phone: opt(p.phone),
      role: p.role,
      status: p.status,
      deleted_at: p.deleted_at,
      deleted_by: p.deleted_by,
      created_at: p.created_at,
    })),
    staff: s.staff.map((s) => ({
      id: s.id,
      full_name: s.full_name,
      slug: s.slug,
      profile_id: s.profile_id,
      active: s.active,
    })),
    company_staff: s.company_staff,
    companies: s.companies.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      nit: opt(c.nit),
      city: opt(c.city),
      department: opt(c.department),
      logo_url: c.logo_url,
      domain: opt(c.domain),
      whatsapp: opt(c.whatsapp),
      accent_color: c.accent_color,
      crm_label: opt(c.crm_label),
      hora_entrada: c.hora_entrada,
      status: c.status as CompanyStatus,
      archived_at: c.archived_at,
      created_at: c.created_at,
    })),
    branches: s.branches.map((b) => ({
      id: b.id,
      company_id: b.company_id,
      name: b.name,
      city: opt(b.city),
      department: opt(b.department),
      is_primary: b.is_primary,
      status: b.status as CompanyStatus,
      created_at: b.created_at,
    })),
    company_modules: s.company_modules.map((m) => ({
      company_id: m.company_id,
      module_code: m.module_code as ModuleCode,
    })),
    company_users: s.company_users.map((cu) => ({
      company_id: cu.company_id,
      user_id: cu.user_id,
      branch_id: cu.branch_id,
      role: cu.role as Exclude<UserRole, "super_admin">,
      removed_at: cu.removed_at,
      puede_editar: cu.puede_editar,
    })),
    financing_types: s.financing_types,
    payment_methods: s.payment_methods,
    products: s.products,
    schools: s.schools,
    channels: s.channels,
    sale_states: s.sale_states,
    cash_concepts: s.cash_concepts,
    company_financing_types: s.company_financing_types.map((f) => ({
      company_id: f.company_id,
      code: f.financing_code,
      active: f.active,
    })),
    company_payment_methods: s.company_payment_methods.map((p) => ({
      company_id: p.company_id,
      code: p.method_code,
      active: p.active,
    })),
    metrics: s.metrics.map((m) => ({
      code: m.code,
      name: m.name,
      unit: m.unit as MetricUnit,
      sort_order: m.sort_order,
    })),
  }
}
