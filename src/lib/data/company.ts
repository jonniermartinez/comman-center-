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

  const [branches, staff, modules] = await Promise.all([
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
  ])

  return {
    ...company,
    branches: branches.data ?? [],
    staff: (staff.data ?? [])
      .map((r) => r.staff)
      .filter((s): s is { id: string; full_name: string; active: boolean } => !!s && s.active)
      .map((s) => ({ id: s.id, full_name: s.full_name }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    modules: (modules.data ?? []).map((m) => m.module_code),
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
