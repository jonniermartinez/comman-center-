"use server"

import { revalidatePath } from "next/cache"

import { requireSession } from "@/lib/auth/session"
import { logAudit } from "@/lib/data/audit"
import { slugify } from "@/lib/format"
import { createClient } from "@/lib/supabase/server"

export interface Result {
  ok: boolean
  error?: string
}

function refrescar() {
  revalidatePath("/", "layout")
}

/** Slug único: es la URL de la empresa, así que no puede chocar con otra. */
async function slugLibre(name: string): Promise<string> {
  const supabase = await createClient()
  const base = slugify(name) || "empresa"
  const { data } = await supabase.from("companies").select("slug").like("slug", `${base}%`)
  const usados = new Set((data ?? []).map((c) => c.slug))

  if (!usados.has(base)) return base
  let n = 2
  while (usados.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

export interface NewCompanyInput {
  name: string
  nit?: string
  city?: string
  department?: string
  accent_color: string
  crm_label?: string
  modules: string[]
  financing_codes: string[]
  payment_codes: string[]
  branches: { name: string; city?: string; department?: string }[]
  assignments: { user_id: string; role: "coordinador" | "asesor"; branch_index: number }[]
}

/**
 * Alta completa de una empresa: datos, sedes, módulos, catálogos y equipo.
 *
 * No es transaccional —son varios INSERT contra PostgREST— así que si algo
 * falla a mitad se devuelve el error y la empresa queda creada pero incompleta.
 * Se puede terminar de configurar desde su pantalla de configuración.
 */
export async function createCompany(
  input: NewCompanyInput,
): Promise<Result & { slug?: string }> {
  const session = await requireSession()
  if (!session.isSuperAdmin) return { ok: false, error: "Solo el super admin crea empresas." }

  const supabase = await createClient()
  const name = input.name.trim()
  if (name.length < 2) return { ok: false, error: "El nombre es obligatorio." }

  const slug = await slugLibre(name)

  const { data: company, error } = await supabase
    .from("companies")
    .insert({
      name,
      slug,
      nit: input.nit?.trim() || null,
      city: input.city?.trim() || null,
      department: input.department?.trim() || null,
      accent_color: input.accent_color,
      crm_label: input.crm_label?.trim() || name,
      created_by: session.profile.id,
    })
    .select("id, slug")
    .single()

  if (error || !company) return { ok: false, error: error?.message ?? "No se pudo crear." }

  // Una empresa nunca queda sin sede: si no se definió ninguna, se crea la principal.
  const sedes = input.branches.length
    ? input.branches
    : [{ name: "Sede principal", city: input.city, department: input.department }]

  const { data: creadas, error: errorSedes } = await supabase
    .from("branches")
    .insert(
      sedes.map((s, i) => ({
        company_id: company.id,
        name: s.name.trim() || `Sede ${i + 1}`,
        city: s.city?.trim() || null,
        department: s.department?.trim() || null,
        is_primary: i === 0,
        created_by: session.profile.id,
      })),
    )
    .select("id, name")

  if (errorSedes) return { ok: false, error: errorSedes.message, slug: company.slug }

  const idsSedes = (creadas ?? []).map((b) => b.id)

  const [modulos, financiaciones, medios, equipo] = await Promise.all([
    supabase.from("company_modules").insert(
      input.modules.map((module_code) => ({
        company_id: company.id,
        module_code,
        enabled_by: session.profile.id,
      })),
    ),
    supabase.from("company_financing_types").insert(
      input.financing_codes.map((financing_code, i) => ({
        company_id: company.id,
        financing_code,
        active: true,
        sort_order: i,
      })),
    ),
    supabase.from("company_payment_methods").insert(
      input.payment_codes.map((method_code, i) => ({
        company_id: company.id,
        method_code,
        active: true,
        sort_order: i,
      })),
    ),
    input.assignments.length
      ? supabase.from("company_users").insert(
          input.assignments.map((a) => ({
            company_id: company.id,
            user_id: a.user_id,
            role: a.role,
            branch_id: idsSedes[a.branch_index] ?? idsSedes[0],
            assigned_by: session.profile.id,
          })),
        )
      : Promise.resolve({ error: null }),
  ])

  const fallo = [modulos, financiaciones, medios, equipo].find((r) => r.error)
  if (fallo?.error) return { ok: false, error: fallo.error.message, slug: company.slug }

  await logAudit({
    action: "create",
    entity: "companies",
    entity_id: company.id,
    company_id: company.id,
    after: { name, sedes: sedes.length, modulos: input.modules.length },
  })

  refrescar()
  return { ok: true, slug: company.slug }
}

export async function updateCompany(
  companyId: string,
  patch: {
    name?: string
    nit?: string | null
    city?: string | null
    department?: string | null
    accent_color?: string
    crm_label?: string | null
  },
): Promise<Result> {
  await requireSession()
  const supabase = await createClient()

  const { error } = await supabase.from("companies").update(patch).eq("id", companyId)
  if (error) return { ok: false, error: error.message }

  await logAudit({
    action: "update",
    entity: "companies",
    entity_id: companyId,
    company_id: companyId,
    after: patch,
  })

  refrescar()
  return { ok: true }
}

/** Las empresas se archivan, nunca se borran: el histórico debe sobrevivir. */
export async function archiveCompany(companyId: string, archivar: boolean): Promise<Result> {
  const session = await requireSession()
  if (!session.isSuperAdmin) return { ok: false, error: "Solo el super admin archiva empresas." }

  const supabase = await createClient()
  const { error } = await supabase
    .from("companies")
    .update(
      archivar
        ? { status: "archivada" as const, archived_at: new Date().toISOString() }
        : { status: "activa" as const, archived_at: null },
    )
    .eq("id", companyId)

  if (error) return { ok: false, error: error.message }

  await logAudit({
    action: archivar ? "archive" : "restore",
    entity: "companies",
    entity_id: companyId,
    company_id: companyId,
  })

  refrescar()
  return { ok: true }
}

export async function setCompanyModules(companyId: string, modules: string[]): Promise<Result> {
  const session = await requireSession()
  const supabase = await createClient()

  const { error: borrado } = await supabase
    .from("company_modules")
    .delete()
    .eq("company_id", companyId)
  if (borrado) return { ok: false, error: borrado.message }

  if (modules.length) {
    const { error } = await supabase.from("company_modules").insert(
      modules.map((module_code) => ({
        company_id: companyId,
        module_code,
        enabled_by: session.profile.id,
      })),
    )
    if (error) return { ok: false, error: error.message }
  }

  await logAudit({
    action: "update",
    entity: "company_modules",
    company_id: companyId,
    after: { modules },
  })

  refrescar()
  return { ok: true }
}

/**
 * Activa o desactiva financiaciones / medios de recaudo de la empresa.
 *
 * Las filas no se borran, se marcan inactivas: si un día vuelve a usarse una
 * financiación, los registros históricos que la referencian siguen teniendo
 * sentido.
 */
export async function setCompanyCatalog(
  companyId: string,
  kind: "financing" | "payment",
  activeCodes: string[],
): Promise<Result> {
  await requireSession()
  const supabase = await createClient()

  const tabla = kind === "financing" ? "company_financing_types" : "company_payment_methods"
  const catalogo = kind === "financing" ? "financing_types" : "payment_methods"
  const columna = kind === "financing" ? "financing_code" : "method_code"

  const { data: todos } = await supabase.from(catalogo).select("code, sort_order")

  const filas = (todos ?? []).map((c) => ({
    company_id: companyId,
    [columna]: c.code,
    active: activeCodes.includes(c.code),
    sort_order: c.sort_order,
  }))

  const { error } = await supabase
    .from(tabla)
    .upsert(filas as never, { onConflict: `company_id,${columna}` })
  if (error) return { ok: false, error: error.message }

  await logAudit({
    action: "update",
    entity: tabla,
    company_id: companyId,
    after: { activos: activeCodes },
  })

  refrescar()
  return { ok: true }
}

export interface CompanyDataCounts {
  sedes: number
  usuarios: number
  comerciales: number
  actividad: number
  ventas: number
  pagos: number
  caja: number
  agendas: number
  objetivos: number
}

/**
 * Qué se va a perder si se borra la empresa. Alimenta la confirmación.
 *
 * Devuelve el motivo cuando no hay conteo: la pantalla lo dice en vez de
 * quedarse contando para siempre, que es lo que pasaba mientras la función de
 * Postgres nombraba tablas del modelo viejo.
 */
export async function companyDataCounts(
  companyId: string,
): Promise<{ counts?: CompanyDataCounts; error?: string }> {
  const session = await requireSession()
  if (!session.isSuperAdmin) return { error: "Solo el super admin puede eliminar una empresa." }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("company_data_counts", {
    target_company: companyId,
  })
  if (error) return { error: error.message }
  if (!data) return { error: "La base no devolvió el conteo." }
  return { counts: data as unknown as CompanyDataCounts }
}

/**
 * Borrado definitivo: la empresa y todos sus datos.
 *
 * Es la excepción a la regla de que acá nada se borra, y por eso pide escribir
 * el nombre: no hay papelera ni deshacer. El camino normal sigue siendo
 * archivar, que conserva el histórico y se puede revertir.
 *
 * La verificación de super admin y el borrado en orden viven en la función
 * `delete_company_cascade` de Postgres: si esta acción se llamara por fuera de
 * la interfaz, la base niega igual.
 */
export async function deleteCompanyForever(
  companyId: string,
  confirmName: string,
): Promise<Result> {
  const session = await requireSession()
  if (!session.isSuperAdmin) {
    return { ok: false, error: "Solo el super admin puede eliminar una empresa." }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc("delete_company_cascade", {
    target_company: companyId,
    confirm_name: confirmName,
  })

  if (error) return { ok: false, error: error.message }

  refrescar()
  return { ok: true }
}

/**
 * Sube (o reemplaza) el logo de una empresa.
 *
 * El archivo va a `company-logos/<company_id>/…`. La primera carpeta de la ruta
 * es la que mira la política de Storage para decidir quién puede escribir, así
 * que la ruta no es una convención cosmética: es parte del permiso.
 *
 * El nombre lleva la marca de tiempo para que el navegador no siga mostrando el
 * logo anterior desde su caché.
 */
export async function uploadCompanyLogo(
  companyId: string,
  formData: FormData,
): Promise<Result & { url?: string }> {
  await requireSession()
  const archivo = formData.get("file")

  if (!(archivo instanceof File) || archivo.size === 0) {
    return { ok: false, error: "No se recibió ninguna imagen." }
  }
  if (archivo.size > 2 * 1024 * 1024) {
    return { ok: false, error: "La imagen pesa más de 2 MB." }
  }

  const supabase = await createClient()
  const extension = archivo.name.split(".").pop()?.toLowerCase() || "png"
  const ruta = `${companyId}/logo-${Date.now()}.${extension}`

  const { error: subida } = await supabase.storage
    .from("company-logos")
    .upload(ruta, archivo, { contentType: archivo.type, upsert: true })

  if (subida) return { ok: false, error: subida.message }

  const {
    data: { publicUrl },
  } = supabase.storage.from("company-logos").getPublicUrl(ruta)

  const { error } = await supabase
    .from("companies")
    .update({ logo_url: publicUrl })
    .eq("id", companyId)
  if (error) return { ok: false, error: error.message }

  await logAudit({
    action: "update",
    entity: "companies",
    entity_id: companyId,
    company_id: companyId,
    after: { logo_url: publicUrl },
  })

  refrescar()
  return { ok: true, url: publicUrl }
}

/** Quita el logo. La empresa vuelve a mostrarse con sus iniciales. */
export async function removeCompanyLogo(companyId: string): Promise<Result> {
  await requireSession()
  const supabase = await createClient()

  const { error } = await supabase
    .from("companies")
    .update({ logo_url: null })
    .eq("id", companyId)
  if (error) return { ok: false, error: error.message }

  // El archivo se deja en Storage: pesa poco y así se puede recuperar si alguien
  // lo quitó por error.
  await logAudit({
    action: "update",
    entity: "companies",
    entity_id: companyId,
    company_id: companyId,
    after: { logo_url: null },
  })

  refrescar()
  return { ok: true }
}
