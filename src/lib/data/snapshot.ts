import "server-only"

import { createClient } from "@/lib/supabase/server"
import { BASE_VACIA } from "@/lib/store/remote"
import type { CompanyStatus, Database, MetricUnit, ModuleCode, UserRole } from "@/lib/store/types"

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

  const [
    profiles,
    staff,
    companyStaff,
    companies,
    branches,
    companyModules,
    companyUsers,
    financing,
    payments,
    products,
    schools,
    channels,
    saleStates,
    cashConcepts,
    companyFinancing,
    companyPayments,
    metrics,
  ] = await Promise.all([
    supabase.from("profiles").select("*"),
    supabase.from("staff").select("*").order("full_name"),
    supabase.from("company_staff").select("company_id, staff_id, branch_id"),
    supabase.from("companies").select("*"),
    supabase.from("branches").select("*"),
    supabase.from("company_modules").select("company_id, module_code"),
    supabase.from("company_users").select("company_id, user_id, branch_id, role, removed_at"),
    supabase.from("financing_types").select("*").order("sort_order"),
    supabase.from("payment_methods").select("*").order("sort_order"),
    supabase.from("products").select("code, name, sort_order").order("sort_order"),
    supabase.from("schools").select("*").order("sort_order"),
    supabase.from("channels").select("*").order("sort_order"),
    supabase.from("sale_states").select("*").order("sort_order"),
    supabase.from("cash_concepts").select("*").order("sort_order"),
    supabase.from("company_financing_types").select("company_id, financing_code, active"),
    supabase.from("company_payment_methods").select("company_id, method_code, active"),
    supabase.from("metrics").select("*").order("sort_order"),
  ])

  if (!profiles.data) return BASE_VACIA

  return {
    profiles: (profiles.data ?? []).map((p) => ({
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
    staff: (staff.data ?? []).map((s) => ({
      id: s.id,
      full_name: s.full_name,
      slug: s.slug,
      profile_id: s.profile_id,
      active: s.active,
    })),
    company_staff: companyStaff.data ?? [],
    companies: (companies.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      nit: opt(c.nit),
      city: opt(c.city),
      department: opt(c.department),
      logo_url: c.logo_url,
      accent_color: c.accent_color,
      crm_label: opt(c.crm_label),
      hora_entrada: c.hora_entrada,
      status: c.status as CompanyStatus,
      archived_at: c.archived_at,
      created_at: c.created_at,
    })),
    branches: (branches.data ?? []).map((b) => ({
      id: b.id,
      company_id: b.company_id,
      name: b.name,
      city: opt(b.city),
      department: opt(b.department),
      is_primary: b.is_primary,
      status: b.status as CompanyStatus,
      created_at: b.created_at,
    })),
    company_modules: (companyModules.data ?? []).map((m) => ({
      company_id: m.company_id,
      module_code: m.module_code as ModuleCode,
    })),
    company_users: (companyUsers.data ?? []).map((cu) => ({
      company_id: cu.company_id,
      user_id: cu.user_id,
      branch_id: cu.branch_id,
      role: cu.role as Exclude<UserRole, "super_admin">,
      removed_at: cu.removed_at,
    })),
    financing_types: financing.data ?? [],
    payment_methods: payments.data ?? [],
    products: products.data ?? [],
    schools: schools.data ?? [],
    channels: channels.data ?? [],
    sale_states: saleStates.data ?? [],
    cash_concepts: cashConcepts.data ?? [],
    company_financing_types: (companyFinancing.data ?? []).map((f) => ({
      company_id: f.company_id,
      code: f.financing_code,
      active: f.active,
    })),
    company_payment_methods: (companyPayments.data ?? []).map((p) => ({
      company_id: p.company_id,
      code: p.method_code,
      active: p.active,
    })),
    metrics: (metrics.data ?? []).map((m) => ({
      code: m.code,
      name: m.name,
      unit: m.unit as MetricUnit,
      sort_order: m.sort_order,
    })),
  }
}
