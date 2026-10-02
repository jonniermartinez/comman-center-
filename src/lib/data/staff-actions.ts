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
 * Una ficha con cuenta que entra al equipo también entra a la empresa.
 *
 * El acceso vive en `company_users`, no en `company_staff`: sin esta fila la
 * persona figura en el equipo pero al entrar ve "no tienes acceso a ninguna
 * empresa". Si ya tenía acceso se respeta su rol; si no, entra como asesor en
 * la sede del equipo (o en la principal, porque un asesor siempre necesita una).
 */
async function darAccesoAEmpresa(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  profileId: string,
  branchId: string | null,
  assignedBy: string,
): Promise<string | null> {
  const { data: actual } = await supabase
    .from("company_users")
    .select("removed_at")
    .eq("company_id", companyId)
    .eq("user_id", profileId)
    .maybeSingle()
  if (actual && !actual.removed_at) return null

  let sede = branchId
  if (!sede) {
    const { data: sedes } = await supabase
      .from("branches")
      .select("id, is_primary")
      .eq("company_id", companyId)
      .eq("status", "activa")
    sede = (sedes ?? []).find((b) => b.is_primary)?.id ?? sedes?.[0]?.id ?? null
    if (!sede) return "La empresa no tiene sedes activas para darle acceso a la cuenta."
  }

  const { error } = await supabase.from("company_users").upsert(
    {
      company_id: companyId,
      user_id: profileId,
      role: "asesor" as const,
      branch_id: sede,
      removed_at: null,
      assigned_by: assignedBy,
    },
    { onConflict: "company_id,user_id" },
  )
  return error ? error.message : null
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
  /** …o una cuenta de acceso que todavía no tiene ficha de comercial… */
  profile_id?: string
  /** …o una nueva, por nombre. */
  full_name?: string
}): Promise<Result> {
  const session = await requireSession()
  const supabase = await createClient()

  let staffId = input.staff_id

  if (!staffId && input.profile_id) {
    // Enlazar una cuenta con una ficha es cosa del super admin, igual que en
    // linkStaffToProfile: decide quién ve qué registros.
    if (!session.isSuperAdmin) {
      return { ok: false, error: "Solo el super admin puede agregar una cuenta como comercial." }
    }

    const { data: yaEnlazada } = await supabase
      .from("staff")
      .select("id")
      .eq("profile_id", input.profile_id)
      .maybeSingle()

    if (yaEnlazada) {
      staffId = yaEnlazada.id
    } else {
      const { data: perfil } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", input.profile_id)
        .is("deleted_at", null)
        .maybeSingle()
      if (!perfil) return { ok: false, error: "Esa cuenta no existe o fue eliminada." }

      const base = slugNombre(perfil.full_name) || "cuenta"
      // El slug es único y varias cuentas de prueba comparten nombre: si ya
      // hay una ficha con ese nombre y no es de esta cuenta, se distingue con
      // un sufijo en vez de robársela a otra persona.
      const { data: ocupados } = await supabase
        .from("staff")
        .select("slug")
        .like("slug", `${base}%`)
      const usados = new Set((ocupados ?? []).map((o) => o.slug))
      let slug = base
      for (let n = 2; usados.has(slug); n++) slug = `${base}_${n}`

      const { data, error } = await supabase
        .from("staff")
        .insert({ full_name: perfil.full_name, slug, profile_id: input.profile_id })
        .select("id")
        .single()
      if (error) return { ok: false, error: error.message }
      staffId = data.id
    }
  }

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

  const { data: ficha } = await supabase
    .from("staff")
    .select("profile_id")
    .eq("id", staffId!)
    .maybeSingle()
  if (ficha?.profile_id) {
    const e = await darAccesoAEmpresa(
      supabase,
      input.company_id,
      ficha.profile_id,
      input.branch_id,
      session.profile.id,
    )
    if (e) return { ok: false, error: e }
  }

  await logAudit({
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
  await requireSession()
  const supabase = await createClient()

  const { error } = await supabase
    .from("company_staff")
    .delete()
    .eq("company_id", companyId)
    .eq("staff_id", staffId)

  if (error) return { ok: false, error: error.message }

  await logAudit({
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

  if (profileId) {
    const { data: equipos } = await supabase
      .from("company_staff")
      .select("company_id, branch_id")
      .eq("staff_id", staffId)
    for (const cs of equipos ?? []) {
      const e = await darAccesoAEmpresa(
        supabase,
        cs.company_id,
        profileId,
        cs.branch_id,
        session.profile.id,
      )
      if (e) return { ok: false, error: e }
    }
  }

  await logAudit({
    action: "update",
    entity: "staff",
    entity_id: staffId,
    after: { profile_id: profileId },
  })

  refrescar()
  return { ok: true }
}

/** El horario de cada persona del equipo, para la tarjeta de Equipo. */
export async function listStaffSchedules(
  companyId: string,
): Promise<{ staffId: string; nombre: string; entrada: string | null; salida: string | null }[]> {
  await requireSession()
  const supabase = await createClient()
  const { data } = await supabase
    .from("company_staff")
    .select("staff_id, hora_entrada, hora_salida, staff(full_name, active)")
    .eq("company_id", companyId)
  return (data ?? [])
    .filter((r) => r.staff?.active)
    .map((r) => ({
      staffId: r.staff_id,
      nombre: r.staff!.full_name,
      entrada: r.hora_entrada,
      salida: r.hora_salida,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
}

/**
 * Fija la hora de entrada o de salida de una persona en una empresa (058).
 *
 * Vacío vuelve al horario de la empresa. La de entrada es contra la que se
 * decide si llegó tarde, y aplica a todas sus jornadas, también las pasadas:
 * no se guarda una "hora esperada" por día.
 */
export async function setStaffSchedule(
  companyId: string,
  staffId: string,
  campo: "hora_entrada" | "hora_salida",
  hora: string | null,
): Promise<Result> {
  await requireSession()
  const supabase = await createClient()

  if (campo !== "hora_entrada" && campo !== "hora_salida") return { ok: false, error: "El dato no es válido." }
  if (hora !== null && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(hora)) {
    return { ok: false, error: "La hora no es válida." }
  }

  const cambio = campo === "hora_entrada" ? { hora_entrada: hora } : { hora_salida: hora }
  const { data, error } = await supabase
    .from("company_staff")
    .update(cambio)
    .eq("company_id", companyId)
    .eq("staff_id", staffId)
    .select("staff_id")

  if (error) return { ok: false, error: error.message }
  if (!data?.length) return { ok: false, error: "No tienes permiso para cambiar el horario." }

  await logAudit({
    action: "update",
    entity: "company_staff",
    entity_id: `${companyId}:${staffId}`,
    company_id: companyId,
    after: cambio,
  })

  refrescar()
  return { ok: true }
}
