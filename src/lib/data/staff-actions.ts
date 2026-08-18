"use server"

import { revalidatePath } from "next/cache"

import { requireSession } from "@/lib/auth/session"
import { logAudit } from "@/lib/data/audit"
import { createClient } from "@/lib/supabase/server"

export interface Result {
  ok: boolean
  error?: string
}

function refrescar() {
  revalidatePath("/", "layout")
}

/** Nombre normalizado: evita tener a la misma persona dos veces por una tilde. */
function slugNombre(nombre: string) {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
}

/**
 * Suma una persona al equipo de una empresa.
 *
 * Si ya existe en el sistema —porque trabaja en otra empresa— se reutiliza: en
 * el histórico hay 17 personas que aparecen en varias, y duplicarlas rompería
 * el ranking y las metas individuales.
 */
export async function addStaffToCompany(input: {
  company_id: string
  branch_id: string | null
  /** Persona existente… */
  staff_id?: string
  /** …o una nueva, por nombre. */
  full_name?: string
}): Promise<Result> {
  const session = await requireSession()
  const supabase = await createClient()

  let staffId = input.staff_id

  if (!staffId) {
    const nombre = (input.full_name ?? "").trim()
    if (nombre.length < 3) return { ok: false, error: "El nombre es demasiado corto." }
    const slug = slugNombre(nombre)

    const { data: existente } = await supabase
      .from("staff")
      .select("id")
      .eq("slug", slug)
      .maybeSingle()

    if (existente) {
      staffId = existente.id
    } else {
      const { data, error } = await supabase
        .from("staff")
        .insert({ full_name: nombre, slug })
        .select("id")
        .single()
      if (error) return { ok: false, error: error.message }
      staffId = data.id
    }
  }

  const { error } = await supabase
    .from("company_staff")
    .upsert(
      { company_id: input.company_id, staff_id: staffId!, branch_id: input.branch_id },
      { onConflict: "company_id,staff_id" },
    )
  if (error) return { ok: false, error: error.message }

  await logAudit({
    actor_id: session.profile.id,
    actor_name: session.profile.full_name,
    action: "assign",
    entity: "company_staff",
    entity_id: staffId,
    company_id: input.company_id,
  })

  refrescar()
  return { ok: true }
}

export async function setStaffBranch(
  companyId: string,
  staffId: string,
  branchId: string | null,
): Promise<Result> {
  await requireSession()
  const supabase = await createClient()

  const { error } = await supabase
    .from("company_staff")
    .update({ branch_id: branchId })
    .eq("company_id", companyId)
    .eq("staff_id", staffId)

  if (error) return { ok: false, error: error.message }
  refrescar()
  return { ok: true }
}

/**
 * Saca a una persona del equipo de una empresa.
 *
 * Se borra el vínculo, no la persona: sus ventas y sus jornadas siguen
 * existiendo a su nombre, porque apuntan a `staff`, no a este vínculo.
 */
export async function removeStaffFromCompany(
  companyId: string,
  staffId: string,
): Promise<Result> {
  const session = await requireSession()
  const supabase = await createClient()

  const { error } = await supabase
    .from("company_staff")
    .delete()
    .eq("company_id", companyId)
    .eq("staff_id", staffId)

  if (error) return { ok: false, error: error.message }

  await logAudit({
    actor_id: session.profile.id,
    actor_name: session.profile.full_name,
    action: "unassign",
    entity: "company_staff",
    entity_id: staffId,
    company_id: companyId,
  })

  refrescar()
  return { ok: true }
}

/**
 * Conecta a una persona del equipo con una cuenta de acceso.
 *
 * Es lo que permite que alguien entre a la aplicación y vea *sus* registros:
 * sin este enlace, la cuenta existe pero el sistema no sabe cuál de los 128
 * comerciales es.
 */
export async function linkStaffToProfile(
  staffId: string,
  profileId: string | null,
): Promise<Result> {
  const session = await requireSession()
  if (!session.isSuperAdmin) {
    return { ok: false, error: "Solo el super admin puede enlazar cuentas." }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("staff")
    .update({ profile_id: profileId })
    .eq("id", staffId)

  if (error) return { ok: false, error: error.message }

  await logAudit({
    actor_id: session.profile.id,
    actor_name: session.profile.full_name,
    action: "update",
    entity: "staff",
    entity_id: staffId,
    after: { profile_id: profileId },
  })

  refrescar()
  return { ok: true }
}
