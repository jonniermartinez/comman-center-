import "server-only"

import { createClient } from "@/lib/supabase/server"

export interface CompanyContext {
  id: string
  name: string
  slug: string
  crm_label: string | null
  hora_entrada: string
  branches: { id: string; name: string; is_primary: boolean }[]
  staff: { id: string; full_name: string }[]
  modules: string[]
  /** Puede registrar a nombre de cualquiera y corregir lo de los demás. */
  canManage: boolean
  /**
   * La persona del equipo que es el usuario en sesión, si está enlazada.
   *
   * Un comercial registra lo suyo; sin este enlace la cuenta existe pero el
   * sistema no sabe cuál de los 128 comerciales es, y no puede registrar nada
   * a su nombre.
   */
  myStaffId: string | null
  /** Catálogos para los formularios de alta. */
  financiaciones: { code: string; name: string }[]
  productos: { code: string; name: string }[]
  escuelas: { code: string; name: string }[]
  estados: { code: string; name: string }[]
  mediosPago: { code: string; name: string }[]
  conceptosCaja: { code: string; name: string }[]
}

/**
 * La empresa de la URL, con lo que necesita cualquier módulo.
 *
 * Devuelve null si no existe **o** si el usuario no tiene acceso: RLS no
 * distingue una cosa de la otra, y está bien que no lo haga —decir "existe pero
 * no puedes verla" ya es información—.
 */
export async function getCompanyContext(slug: string): Promise<CompanyContext | null> {
  const supabase = await createClient()

  const { data: company } = await supabase
    .from("companies")
    .select("id, name, slug, crm_label, hora_entrada")
    .eq("slug", slug)
    .maybeSingle()

  if (!company) return null

  const [branches, staff, modules, sesion, financiaciones, productos, escuelas, estados, medios, conceptos] = await Promise.all([
    supabase
      .from("branches")
      .select("id, name, is_primary")
      .eq("company_id", company.id)
      .eq("status", "activa")
      .order("is_primary", { ascending: false })
      .order("name"),
    supabase
      .from("company_staff")
      .select("staff(id, full_name, active)")
      .eq("company_id", company.id),
    supabase.from("company_modules").select("module_code").eq("company_id", company.id),
    supabase.rpc("can_manage_company", { target_company: company.id }),
    supabase.from("financing_types").select("code, name").order("sort_order"),
    supabase.from("products").select("code, name").order("sort_order"),
    supabase.from("schools").select("code, name").order("sort_order"),
    supabase.from("sale_states").select("code, name").order("sort_order"),
    supabase.from("payment_methods").select("code, name").order("sort_order"),
    supabase.from("cash_concepts").select("code, name").order("sort_order"),
  ])

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: yo } = user
    ? await supabase.from("staff").select("id").eq("profile_id", user.id).maybeSingle()
    : { data: null }

  return {
    ...company,
    branches: branches.data ?? [],
    staff: (staff.data ?? [])
      .map((r) => r.staff)
      .filter((s): s is { id: string; full_name: string; active: boolean } => !!s && s.active)
      .map((s) => ({ id: s.id, full_name: s.full_name }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    modules: (modules.data ?? []).map((m) => m.module_code),
    canManage: Boolean(sesion.data),
    myStaffId: yo?.id ?? null,
    financiaciones: financiaciones.data ?? [],
    productos: productos.data ?? [],
    escuelas: escuelas.data ?? [],
    estados: estados.data ?? [],
    mediosPago: medios.data ?? [],
    conceptosCaja: conceptos.data ?? [],
  }
}

/** Conserva los filtros al cambiar de página. */
export function construirHref(
  base: string,
  params: Record<string, string | string[] | undefined>,
  page: number,
) {
  const next = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string" && v) next.set(k, v)
  }
  if (page > 0) next.set("p", String(page))
  else next.delete("p")
  const q = next.toString()
  return q ? `${base}?${q}` : base
}
