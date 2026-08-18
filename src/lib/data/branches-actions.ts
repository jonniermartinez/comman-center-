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

export async function createBranch(input: {
  company_id: string
  name: string
  city?: string
  department?: string
  is_primary?: boolean
}): Promise<Result> {
  const session = await requireSession()
  const supabase = await createClient()

  const { data: existentes } = await supabase
    .from("branches")
    .select("id")
    .eq("company_id", input.company_id)

  // La primera sede de una empresa es la principal por defecto.
  const esPrincipal = input.is_primary ?? (existentes ?? []).length === 0
  if (esPrincipal) {
    // El índice único deja una sola principal: hay que soltarla antes de poner
    // la nueva, o el INSERT choca.
    await supabase
      .from("branches")
      .update({ is_primary: false })
      .eq("company_id", input.company_id)
      .eq("is_primary", true)
  }

  const { data, error } = await supabase
    .from("branches")
    .insert({
      company_id: input.company_id,
      name: input.name.trim(),
      city: input.city?.trim() || null,
      department: input.department?.trim() || null,
      is_primary: esPrincipal,
      created_by: session.profile.id,
    })
    .select("id")
    .single()

  if (error) return { ok: false, error: error.message }

  await logAudit({
    actor_id: session.profile.id,
    actor_name: session.profile.full_name,
    action: "create",
    entity: "branches",
    entity_id: data?.id,
    company_id: input.company_id,
    after: { name: input.name },
  })

  refrescar()
  return { ok: true }
}

export async function updateBranch(
  branchId: string,
  patch: { name?: string; city?: string | null; department?: string | null },
): Promise<Result> {
  const session = await requireSession()
  const supabase = await createClient()

  const { error } = await supabase.from("branches").update(patch).eq("id", branchId)
  if (error) return { ok: false, error: error.message }

  await logAudit({
    actor_id: session.profile.id,
    actor_name: session.profile.full_name,
    action: "update",
    entity: "branches",
    entity_id: branchId,
    after: patch,
  })

  refrescar()
  return { ok: true }
}

export async function setPrimaryBranch(branchId: string): Promise<Result> {
  const session = await requireSession()
  const supabase = await createClient()

  const { data: sede } = await supabase
    .from("branches")
    .select("company_id, name")
    .eq("id", branchId)
    .single()
  if (!sede) return { ok: false, error: "La sede no existe." }

  // Primero se suelta la principal actual: solo puede haber una por empresa.
  await supabase
    .from("branches")
    .update({ is_primary: false })
    .eq("company_id", sede.company_id)
    .eq("is_primary", true)

  const { error } = await supabase
    .from("branches")
    .update({ is_primary: true })
    .eq("id", branchId)
  if (error) return { ok: false, error: error.message }

  await logAudit({
    actor_id: session.profile.id,
    actor_name: session.profile.full_name,
    action: "update",
    entity: "branches",
    entity_id: branchId,
    company_id: sede.company_id,
    after: { is_primary: true },
  })

  refrescar()
  return { ok: true }
}

/**
 * Las sedes se archivan, no se borran: sus registros históricos siguen
 * contando en el acumulado de la empresa.
 */
export async function archiveBranch(branchId: string): Promise<Result> {
  const session = await requireSession()
  const supabase = await createClient()

  const { data: sede } = await supabase
    .from("branches")
    .select("company_id, name, is_primary")
    .eq("id", branchId)
    .single()
  if (!sede) return { ok: false, error: "La sede no existe." }

  const { data: activas } = await supabase
    .from("branches")
    .select("id")
    .eq("company_id", sede.company_id)
    .eq("status", "activa")

  if ((activas ?? []).length <= 1) {
    return { ok: false, error: "Una empresa debe tener al menos una sede activa." }
  }

  const { data: asignados } = await supabase
    .from("company_users")
    .select("user_id")
    .eq("branch_id", branchId)
    .is("removed_at", null)

  if ((asignados ?? []).length > 0) {
    return {
      ok: false,
      error: `Hay ${asignados!.length} comercial(es) asignados. Muévelos a otra sede primero.`,
    }
  }

  // Si era la principal, otra sede activa toma el relevo.
  if (sede.is_primary) {
    const otra = (activas ?? []).find((b) => b.id !== branchId)
    await supabase.from("branches").update({ is_primary: false }).eq("id", branchId)
    if (otra) await supabase.from("branches").update({ is_primary: true }).eq("id", otra.id)
  }

  const { error } = await supabase
    .from("branches")
    .update({ status: "archivada" })
    .eq("id", branchId)
  if (error) return { ok: false, error: error.message }

  await logAudit({
    actor_id: session.profile.id,
    actor_name: session.profile.full_name,
    action: "archive",
    entity: "branches",
    entity_id: branchId,
    company_id: sede.company_id,
  })

  refrescar()
  return { ok: true }
}

export async function restoreBranch(branchId: string): Promise<Result> {
  const session = await requireSession()
  const supabase = await createClient()

  const { error } = await supabase
    .from("branches")
    .update({ status: "activa" })
    .eq("id", branchId)
  if (error) return { ok: false, error: error.message }

  await logAudit({
    actor_id: session.profile.id,
    actor_name: session.profile.full_name,
    action: "restore",
    entity: "branches",
    entity_id: branchId,
  })

  refrescar()
  return { ok: true }
}

/**
 * Asigna (o reasigna) un comercial a la empresa y a una sede.
 *
 * Un asesor siempre necesita sede: es donde registra. Un coordinador puede
 * quedar sin sede y supervisar la empresa completa.
 */
export async function assignUserToCompany(
  companyId: string,
  userId: string,
  role: "coordinador" | "asesor",
  branchId?: string | null,
): Promise<Result> {
  const session = await requireSession()
  const supabase = await createClient()

  let resolved = branchId ?? null
  if (role === "asesor" && !resolved) {
    const { data: sedes } = await supabase
      .from("branches")
      .select("id, is_primary")
      .eq("company_id", companyId)
      .eq("status", "activa")
    resolved = (sedes ?? []).find((b) => b.is_primary)?.id ?? sedes?.[0]?.id ?? null
    if (!resolved) return { ok: false, error: "La empresa no tiene sedes activas." }
  }

  const { error } = await supabase.from("company_users").upsert(
    {
      company_id: companyId,
      user_id: userId,
      role,
      branch_id: resolved,
      removed_at: null,
      assigned_by: session.profile.id,
    },
    { onConflict: "company_id,user_id" },
  )
  if (error) return { ok: false, error: error.message }

  await logAudit({
    actor_id: session.profile.id,
    actor_name: session.profile.full_name,
    action: "assign",
    entity: "company_users",
    entity_id: userId,
    company_id: companyId,
    after: { role, branch_id: resolved },
  })

  refrescar()
  return { ok: true }
}

/** Desasignación lógica: deja de ver la empresa, sus registros se conservan. */
export async function unassignUserFromCompany(
  companyId: string,
  userId: string,
): Promise<Result> {
  const session = await requireSession()
  const supabase = await createClient()

  const { error } = await supabase
    .from("company_users")
    .update({ removed_at: new Date().toISOString() })
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .is("removed_at", null)

  if (error) return { ok: false, error: error.message }

  await logAudit({
    actor_id: session.profile.id,
    actor_name: session.profile.full_name,
    action: "unassign",
    entity: "company_users",
    entity_id: userId,
    company_id: companyId,
  })

  refrescar()
  return { ok: true }
}
