import "server-only"

import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/store/types"
import { BASE_VACIA } from "@/lib/store/remote"
import type { Jornada, ModuleCode, UserRole, VentaKind } from "@/lib/store/types"

/** null → undefined: el modelo de la app usa opcionales, Postgres usa null. */
function opt(value: string | null): string | undefined {
  return value ?? undefined
}

/**
 * Tope de filas por tabla de captura.
 *
 * Hoy la app carga los registros completos y calcula los agregados en el
 * cliente, igual que hacía con localStorage. Funciona porque el volumen es de
 * meses de captura manual, no de años importados.
 *
 * Antes de traer el histórico del Excel hay que mover los listados a paginación
 * en el servidor y el dashboard a las vistas SQL (`v_monthly_totals`,
 * `v_branch_monthly`, `v_monthly_kpi`…), que para eso están escritas. Este tope
 * existe para que ese día se note con una cifra que no cuadra, y no con una
 * página que tarda un minuto en abrir.
 */
const TOPE_REGISTROS = 20_000

/**
 * Todo lo que la app necesita, en una sola tanda de consultas.
 *
 * No lleva filtros por usuario: las políticas RLS ya devuelven únicamente lo
 * que esa sesión puede ver. Si alguien sin empresas asignadas pide esto, recibe
 * listas vacías, que es exactamente lo que debe pasar.
 */
export async function loadSnapshot(): Promise<Database> {
  const supabase = await createClient()

  const [
    profiles,
    companies,
    branches,
    companyModules,
    companyUsers,
    financing,
    payments,
    companyFinancing,
    companyPayments,
    metrics,
    dailyKpi,
    dailyManagement,
    sales,
    billing,
    collection,
    objectives,
  ] = await Promise.all([
    supabase.from("profiles").select("*"),
    supabase.from("companies").select("*"),
    supabase.from("branches").select("*"),
    supabase.from("company_modules").select("company_id, module_code"),
    supabase.from("company_users").select("company_id, user_id, branch_id, role, removed_at"),
    supabase.from("financing_types").select("*").order("sort_order"),
    supabase.from("payment_methods").select("*").order("sort_order"),
    supabase.from("company_financing_types").select("company_id, financing_code, active"),
    supabase.from("company_payment_methods").select("company_id, method_code, active"),
    supabase.from("metrics").select("*").order("sort_order"),
    supabase
      .from("daily_kpi")
      .select("*")
      .order("report_date", { ascending: false })
      .range(0, TOPE_REGISTROS),
    supabase
      .from("daily_management")
      .select("*")
      .order("report_date", { ascending: false })
      .range(0, TOPE_REGISTROS),
    supabase
      .from("sales_entries")
      .select("*")
      .order("report_date", { ascending: false })
      .range(0, TOPE_REGISTROS),
    supabase
      .from("billing_entries")
      .select("*")
      .order("report_date", { ascending: false })
      .range(0, TOPE_REGISTROS),
    supabase
      .from("collection_entries")
      .select("*")
      .order("report_date", { ascending: false })
      .range(0, TOPE_REGISTROS),
    supabase.from("objectives").select("*"),
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
      status: c.status,
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
      status: b.status,
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
      unit: m.unit as "cantidad" | "moneda" | "porcentaje",
      sort_order: m.sort_order,
    })),
    daily_kpi: (dailyKpi.data ?? []).map((k) => ({
      ...k,
      jornada: k.jornada as Jornada,
      notas: opt(k.notas),
    })),
    daily_management: (dailyManagement.data ?? []).map((d) => ({
      ...d,
      jornada: d.jornada as Jornada,
      notas: opt(d.notas),
    })),
    sales_entries: (sales.data ?? []).map((s) => ({
      id: s.id,
      company_id: s.company_id,
      branch_id: s.branch_id,
      report_date: s.report_date,
      user_id: s.user_id,
      responsable_nombre: s.responsable_nombre,
      financing_code: s.financing_code,
      kind: s.kind as VentaKind,
      ventas: s.ventas,
      licencias: s.licencias,
    })),
    // Facturación y recaudo comparten forma en la app: un monto con su código.
    billing_entries: (billing.data ?? []).map((b) => ({
      id: b.id,
      company_id: b.company_id,
      branch_id: b.branch_id,
      report_date: b.report_date,
      code: b.financing_code,
      amount: Number(b.amount),
    })),
    collection_entries: (collection.data ?? []).map((c) => ({
      id: c.id,
      company_id: c.company_id,
      branch_id: c.branch_id,
      report_date: c.report_date,
      code: c.method_code,
      amount: Number(c.amount),
    })),
    objectives: (objectives.data ?? []).map((o) => ({
      id: o.id,
      company_id: o.company_id,
      period_month: o.period_month,
      metric_code: o.metric_code,
      user_id: o.user_id,
      target_value: Number(o.target_value),
      locked: o.locked,
    })),
  }
}
