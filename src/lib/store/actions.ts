"use client"

import { slugify } from "@/lib/format"
import type { KpiTotals } from "@/lib/kpi"
import { write, read } from "./db"
import type {
  AmountEntry,
  Branch,
  Company,
  DailyManagement,
  Database,
  Jornada,
  ModuleCode,
  Profile,
  SalesEntry,
  UserRole,
} from "./types"

/**
 * Acciones de negocio. Cada una es la contraparte de lo que después será una
 * mutación en Supabase, y todas las que tocan usuarios/empresas/objetivos
 * dejan rastro en audit_log.
 */

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function nowISO() {
  return new Date().toISOString()
}

function actorName(db: Database) {
  return db.profiles.find((p) => p.id === db.current_user_id)?.full_name ?? "Sistema"
}

function audit(
  db: Database,
  entry: { action: string; entity: string; entity_id?: string; company_id?: string | null; detail: string },
) {
  db.audit_log.unshift({
    id: uid("au"),
    actor_name: actorName(db),
    created_at: nowISO(),
    ...entry,
  })
  // El log de la demo se mantiene acotado.
  if (db.audit_log.length > 300) db.audit_log.length = 300
}

// ---------------------------------------------------------------
// Empresas
// ---------------------------------------------------------------

export interface NewCompanyInput {
  name: string
  nit?: string
  city?: string
  department?: string
  accent_color: string
  crm_label?: string
  modules: ModuleCode[]
  financing_codes: string[]
  payment_codes: string[]
  /** Sedes de la empresa. La primera queda como principal. */
  branches: { name: string; city?: string; department?: string }[]
  /** Cada comercial se asigna a una sede, por índice dentro de `branches`. */
  assignments: {
    user_id: string
    role: Exclude<UserRole, "super_admin">
    branch_index: number
  }[]
}

export function createCompany(input: NewCompanyInput): string {
  const companyId = uid("co")

  write((db) => {
    // El slug debe ser único: es la URL de la empresa.
    const base = slugify(input.name) || "empresa"
    let slug = base
    let n = 2
    while (db.companies.some((c) => c.slug === slug)) slug = `${base}-${n++}`

    const company: Company = {
      id: companyId,
      name: input.name.trim(),
      slug,
      nit: input.nit?.trim() || undefined,
      city: input.city?.trim() || undefined,
      department: input.department?.trim() || undefined,
      accent_color: input.accent_color,
      crm_label: input.crm_label?.trim() || input.name.trim(),
      status: "activa",
      created_at: nowISO(),
    }

    db.companies.push(company)
    db.company_modules.push(
      ...input.modules.map((module_code) => ({ company_id: companyId, module_code })),
    )
    db.company_financing_types.push(
      ...db.financing_types.map((f) => ({
        company_id: companyId,
        code: f.code,
        active: input.financing_codes.includes(f.code),
      })),
    )
    db.company_payment_methods.push(
      ...db.payment_methods.map((pm) => ({
        company_id: companyId,
        code: pm.code,
        active: input.payment_codes.includes(pm.code),
      })),
    )
    // Sedes. Si no se definió ninguna, se crea una "Sede principal" con la
    // ciudad de la empresa: una empresa nunca queda sin sede.
    const sedes = input.branches.length
      ? input.branches
      : [{ name: "Sede principal", city: input.city, department: input.department }]

    const branchIds = sedes.map((sede, i) => {
      const branchId = uid("br")
      db.branches.push({
        id: branchId,
        company_id: companyId,
        name: sede.name.trim() || `Sede ${i + 1}`,
        city: sede.city?.trim() || undefined,
        department: sede.department?.trim() || undefined,
        is_primary: i === 0,
        status: "activa",
        created_at: nowISO(),
      })
      return branchId
    })

    db.company_users.push(
      ...input.assignments.map((a) => ({
        company_id: companyId,
        user_id: a.user_id,
        branch_id: branchIds[a.branch_index] ?? branchIds[0],
        role: a.role,
      })),
    )

    audit(db, {
      action: "create",
      entity: "companies",
      entity_id: companyId,
      company_id: companyId,
      detail: `Creó la empresa ${company.name} con ${sedes.length} sede(s), ${input.modules.length} módulo(s) y ${input.assignments.length} comercial(es)`,
    })
  })

  return companyId
}

export function updateCompany(companyId: string, patch: Partial<Company>) {
  write((db) => {
    const company = db.companies.find((c) => c.id === companyId)
    if (!company) return
    Object.assign(company, patch)
    audit(db, {
      action: "update",
      entity: "companies",
      entity_id: companyId,
      company_id: companyId,
      detail: `Actualizó los datos de ${company.name}`,
    })
  })
}

/** Las empresas se archivan, nunca se borran: el histórico debe sobrevivir. */
export function archiveCompany(companyId: string) {
  write((db) => {
    const company = db.companies.find((c) => c.id === companyId)
    if (!company) return
    company.status = "archivada"
    company.archived_at = nowISO()
    audit(db, {
      action: "archive",
      entity: "companies",
      entity_id: companyId,
      company_id: companyId,
      detail: `Archivó la empresa ${company.name}. Los registros históricos se conservan.`,
    })
  })
}

export function restoreCompany(companyId: string) {
  write((db) => {
    const company = db.companies.find((c) => c.id === companyId)
    if (!company) return
    company.status = "activa"
    company.archived_at = null
    audit(db, {
      action: "restore",
      entity: "companies",
      entity_id: companyId,
      company_id: companyId,
      detail: `Reactivó la empresa ${company.name}`,
    })
  })
}

export function setCompanyModules(companyId: string, modules: ModuleCode[]) {
  write((db) => {
    db.company_modules = db.company_modules.filter((m) => m.company_id !== companyId)
    db.company_modules.push(...modules.map((module_code) => ({ company_id: companyId, module_code })))
    audit(db, {
      action: "update",
      entity: "company_modules",
      company_id: companyId,
      detail: `Módulos habilitados: ${modules.join(", ") || "ninguno"}`,
    })
  })
}

export function setCompanyCatalog(
  companyId: string,
  kind: "financing" | "payment",
  activeCodes: string[],
) {
  write((db) => {
    const key = kind === "financing" ? "company_financing_types" : "company_payment_methods"
    const catalog = kind === "financing" ? db.financing_types : db.payment_methods
    db[key] = db[key].filter((r) => r.company_id !== companyId)
    db[key].push(
      ...catalog.map((c) => ({
        company_id: companyId,
        code: c.code,
        active: activeCodes.includes(c.code),
      })),
    )
    audit(db, {
      action: "update",
      entity: key,
      company_id: companyId,
      detail: `${kind === "financing" ? "Financiaciones" : "Medios de recaudo"} activos: ${activeCodes.length}`,
    })
  })
}

// ---------------------------------------------------------------
// Sedes
// ---------------------------------------------------------------

export function createBranch(input: {
  company_id: string
  name: string
  city?: string
  department?: string
  is_primary?: boolean
}): string {
  const branchId = uid("br")
  write((db) => {
    const existentes = db.branches.filter((b) => b.company_id === input.company_id)
    // La primera sede de una empresa es la principal por defecto.
    const esPrincipal = input.is_primary ?? existentes.length === 0
    if (esPrincipal) {
      for (const b of existentes) b.is_primary = false
    }

    db.branches.push({
      id: branchId,
      company_id: input.company_id,
      name: input.name.trim(),
      city: input.city?.trim() || undefined,
      department: input.department?.trim() || undefined,
      is_primary: esPrincipal,
      status: "activa",
      created_at: nowISO(),
    })

    const company = db.companies.find((c) => c.id === input.company_id)
    audit(db, {
      action: "create",
      entity: "branches",
      entity_id: branchId,
      company_id: input.company_id,
      detail: `Creó la sede ${input.name} en ${company?.name}`,
    })
  })
  return branchId
}

export function updateBranch(branchId: string, patch: Partial<Branch>) {
  write((db) => {
    const branch = db.branches.find((b) => b.id === branchId)
    if (!branch) return
    Object.assign(branch, patch)
    audit(db, {
      action: "update",
      entity: "branches",
      entity_id: branchId,
      company_id: branch.company_id,
      detail: `Actualizó la sede ${branch.name}`,
    })
  })
}

export function setPrimaryBranch(branchId: string) {
  write((db) => {
    const branch = db.branches.find((b) => b.id === branchId)
    if (!branch) return
    for (const b of db.branches.filter((x) => x.company_id === branch.company_id)) {
      b.is_primary = b.id === branchId
    }
    audit(db, {
      action: "update",
      entity: "branches",
      entity_id: branchId,
      company_id: branch.company_id,
      detail: `${branch.name} quedó como sede principal`,
    })
  })
}

/**
 * Las sedes se archivan, no se borran: sus registros históricos siguen
 * contando en el acumulado de la empresa.
 */
export function archiveBranch(branchId: string): { ok: boolean; error?: string } {
  const db = read()
  const branch = db.branches.find((b) => b.id === branchId)
  if (!branch) return { ok: false, error: "La sede no existe." }

  const activas = db.branches.filter(
    (b) => b.company_id === branch.company_id && b.status === "activa",
  )
  if (activas.length <= 1) {
    return { ok: false, error: "Una empresa debe tener al menos una sede activa." }
  }

  const asignados = db.company_users.filter(
    (cu) => cu.branch_id === branchId && !cu.removed_at,
  ).length
  if (asignados > 0) {
    return {
      ok: false,
      error: `Hay ${asignados} comercial(es) asignados. Muévelos a otra sede primero.`,
    }
  }

  write((draft) => {
    const b = draft.branches.find((x) => x.id === branchId)
    if (!b) return
    b.status = "archivada"
    // Si era la principal, la principal pasa a otra sede activa.
    if (b.is_primary) {
      const otra = draft.branches.find(
        (x) => x.company_id === b.company_id && x.id !== branchId && x.status === "activa",
      )
      if (otra) {
        b.is_primary = false
        otra.is_primary = true
      }
    }
    audit(draft, {
      action: "archive",
      entity: "branches",
      entity_id: branchId,
      company_id: b.company_id,
      detail: `Archivó la sede ${b.name}. Sus registros históricos se conservan.`,
    })
  })

  return { ok: true }
}

export function restoreBranch(branchId: string) {
  write((db) => {
    const branch = db.branches.find((b) => b.id === branchId)
    if (!branch) return
    branch.status = "activa"
    audit(db, {
      action: "restore",
      entity: "branches",
      entity_id: branchId,
      company_id: branch.company_id,
      detail: `Reactivó la sede ${branch.name}`,
    })
  })
}

// ---------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------

export interface NewUserInput {
  full_name: string
  email: string
  phone?: string
  role: UserRole
  assignments: { company_id: string; role: Exclude<UserRole, "super_admin"> }[]
}

export function createUser(input: NewUserInput): string {
  const userId = uid("us")
  write((db) => {
    const profile: Profile = {
      id: userId,
      full_name: input.full_name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim() || undefined,
      role: input.role,
      // Nace invitado: se activa cuando define su contraseña.
      status: "invitado",
      created_at: nowISO(),
    }
    db.profiles.push(profile)
    db.company_users.push(
      ...input.assignments.map((a) => ({
        company_id: a.company_id,
        user_id: userId,
        role: a.role,
      })),
    )
    audit(db, {
      action: "create",
      entity: "profiles",
      entity_id: userId,
      detail: `Creó el usuario ${profile.full_name} (${profile.email}) e invitó por email`,
    })
  })
  return userId
}

export function updateUser(userId: string, patch: Partial<Profile>) {
  write((db) => {
    const profile = db.profiles.find((p) => p.id === userId)
    if (!profile) return
    Object.assign(profile, patch)
    audit(db, {
      action: "update",
      entity: "profiles",
      entity_id: userId,
      detail: `Actualizó el usuario ${profile.full_name}`,
    })
  })
}

/**
 * Baja lógica. El perfil nunca se borra: los registros históricos siguen
 * mostrando el nombre del responsable. Solo se revoca el acceso.
 */
export function softDeleteUser(userId: string): { ok: boolean; error?: string } {
  const db = read()
  if (userId === db.current_user_id) {
    return { ok: false, error: "No puedes eliminarte a ti mismo." }
  }

  write((draft) => {
    const profile = draft.profiles.find((p) => p.id === userId)
    if (!profile) return
    profile.status = "eliminado"
    profile.deleted_at = nowISO()
    profile.deleted_by = draft.current_user_id

    // Deja de ver empresas, pero sus registros siguen atados a ellas.
    for (const cu of draft.company_users) {
      if (cu.user_id === userId && !cu.removed_at) cu.removed_at = nowISO()
    }

    const registros =
      draft.daily_kpi.filter((r) => r.user_id === userId).length +
      draft.daily_management.filter((r) => r.user_id === userId).length

    audit(draft, {
      action: "delete",
      entity: "profiles",
      entity_id: userId,
      detail: `Eliminó a ${profile.full_name}. Se revocó el acceso; ${registros} registro(s) históricos se conservan a su nombre.`,
    })
  })

  return { ok: true }
}

export function restoreUser(userId: string) {
  write((db) => {
    const profile = db.profiles.find((p) => p.id === userId)
    if (!profile) return
    profile.status = "activo"
    profile.deleted_at = null
    profile.deleted_by = null
    audit(db, {
      action: "restore",
      entity: "profiles",
      entity_id: userId,
      detail: `Restauró a ${profile.full_name}`,
    })
  })
}

export function setUserStatus(userId: string, status: Profile["status"]) {
  write((db) => {
    const profile = db.profiles.find((p) => p.id === userId)
    if (!profile) return
    profile.status = status
    audit(db, {
      action: "update",
      entity: "profiles",
      entity_id: userId,
      detail: `${profile.full_name} quedó en estado ${status}`,
    })
  })
}

export function assignUserToCompany(
  companyId: string,
  userId: string,
  role: Exclude<UserRole, "super_admin">,
  branchId?: string | null,
) {
  write((db) => {
    // Un asesor siempre necesita sede: es donde registra. Si no se indicó, va a
    // la principal. Un coordinador puede quedar sin sede y supervisar toda la
    // empresa.
    const resolved =
      branchId !== undefined
        ? branchId
        : (db.branches.find((b) => b.company_id === companyId && b.is_primary)?.id ?? null)

    const existing = db.company_users.find(
      (cu) => cu.company_id === companyId && cu.user_id === userId,
    )
    if (existing) {
      existing.role = role
      existing.branch_id = role === "asesor" ? (resolved ?? existing.branch_id) : resolved
      existing.removed_at = null
    } else {
      db.company_users.push({
        company_id: companyId,
        user_id: userId,
        branch_id: resolved,
        role,
      })
    }

    const profile = db.profiles.find((p) => p.id === userId)
    const company = db.companies.find((c) => c.id === companyId)
    const branch = db.branches.find((b) => b.id === resolved)
    audit(db, {
      action: "assign",
      entity: "company_users",
      company_id: companyId,
      detail: `Asignó a ${profile?.full_name} como ${role} en ${company?.name}${
        branch ? ` · ${branch.name}` : " (toda la empresa)"
      }`,
    })
  })
}

export function unassignUserFromCompany(companyId: string, userId: string) {
  write((db) => {
    const cu = db.company_users.find(
      (x) => x.company_id === companyId && x.user_id === userId && !x.removed_at,
    )
    if (!cu) return
    cu.removed_at = nowISO()
    const profile = db.profiles.find((p) => p.id === userId)
    const company = db.companies.find((c) => c.id === companyId)
    audit(db, {
      action: "unassign",
      entity: "company_users",
      company_id: companyId,
      detail: `Quitó a ${profile?.full_name} de ${company?.name}. Sus registros previos se conservan.`,
    })
  })
}

// ---------------------------------------------------------------
// Registros de captura
// ---------------------------------------------------------------

/** Un registro por empresa + fecha + responsable + jornada. Reenviar edita. */
export function saveDailyKpi(input: {
  company_id: string
  branch_id: string
  report_date: string
  user_id: string
  jornada: Jornada
  values: KpiTotals
  notas?: string
}) {
  write((db) => {
    const responsable = db.profiles.find((p) => p.id === input.user_id)
    const existing = db.daily_kpi.find(
      (k) =>
        k.company_id === input.company_id &&
        k.report_date === input.report_date &&
        k.user_id === input.user_id &&
        k.jornada === input.jornada,
    )

    if (existing) {
      Object.assign(existing, input.values, { notas: input.notas, updated_at: nowISO() })
    } else {
      db.daily_kpi.push({
        id: uid("kpi"),
        company_id: input.company_id,
        branch_id: input.branch_id,
        report_date: input.report_date,
        user_id: input.user_id,
        // Snapshot del nombre: el reporte histórico no cambia si renombran el perfil.
        responsable_nombre: responsable?.full_name ?? "—",
        jornada: input.jornada,
        notas: input.notas,
        created_at: nowISO(),
        updated_at: nowISO(),
        ...input.values,
      })
    }
  })
}

export function saveDailyManagement(input: {
  company_id: string
  branch_id: string
  report_date: string
  user_id: string
  jornada: Jornada
  chats_por_responder: number
  tareas_del_dia: number
  tareas_caducadas: number
  certificados: number
  notas?: string
}) {
  write((db) => {
    const responsable = db.profiles.find((p) => p.id === input.user_id)
    const existing = db.daily_management.find(
      (r) =>
        r.company_id === input.company_id &&
        r.report_date === input.report_date &&
        r.user_id === input.user_id &&
        r.jornada === input.jornada,
    )
    const values = {
      chats_por_responder: input.chats_por_responder,
      tareas_del_dia: input.tareas_del_dia,
      tareas_caducadas: input.tareas_caducadas,
      certificados: input.certificados,
      notas: input.notas,
    }

    if (existing) {
      Object.assign(existing, values, { updated_at: nowISO() })
    } else {
      const row: DailyManagement = {
        id: uid("dm"),
        company_id: input.company_id,
        branch_id: input.branch_id,
        report_date: input.report_date,
        user_id: input.user_id,
        responsable_nombre: responsable?.full_name ?? "—",
        jornada: input.jornada,
        created_at: nowISO(),
        updated_at: nowISO(),
        ...values,
      }
      db.daily_management.push(row)
    }
  })
}

export interface SalesReportInput {
  company_id: string
  branch_id: string
  report_date: string
  /** financing_code → { ventas, licencias } */
  ventas: Record<string, { ventas: number; licencias: number }>
  renovaciones: Record<string, number>
  facturacion: Record<string, number>
  recaudo: Record<string, number>
}

export function saveSalesReport(input: SalesReportInput) {
  write((db) => {
    const { company_id, branch_id, report_date } = input

    // Se reemplaza el día completo de ESA sede: el formulario es la única fuente
    // de ese día para esa sede, y no debe tocar lo reportado por las demás.
    const mismoDia = (r: { company_id: string; branch_id: string; report_date: string }) =>
      r.company_id === company_id && r.branch_id === branch_id && r.report_date === report_date

    db.sales_entries = db.sales_entries.filter((r) => !mismoDia(r))
    db.billing_entries = db.billing_entries.filter((r) => !mismoDia(r))
    db.collection_entries = db.collection_entries.filter((r) => !mismoDia(r))

    const sales: SalesEntry[] = []
    for (const [code, v] of Object.entries(input.ventas)) {
      if (!v.ventas && !v.licencias) continue
      sales.push({
        id: uid("se"),
        company_id,
        branch_id,
        report_date,
        user_id: null,
        responsable_nombre: null,
        financing_code: code,
        kind: "venta",
        ventas: v.ventas,
        licencias: v.licencias,
      })
    }
    for (const [code, cantidad] of Object.entries(input.renovaciones)) {
      if (!cantidad) continue
      sales.push({
        id: uid("se"),
        company_id,
        branch_id,
        report_date,
        user_id: null,
        responsable_nombre: null,
        financing_code: code,
        kind: "renovacion",
        ventas: cantidad,
        licencias: 0,
      })
    }
    db.sales_entries.push(...sales)

    const toAmounts = (record: Record<string, number>): AmountEntry[] =>
      Object.entries(record)
        .filter(([, amount]) => amount > 0)
        .map(([code, amount]) => ({
          id: uid("am"),
          company_id,
          branch_id,
          report_date,
          code,
          amount,
        }))

    db.billing_entries.push(...toAmounts(input.facturacion))
    db.collection_entries.push(...toAmounts(input.recaudo))
  })
}

// ---------------------------------------------------------------
// Objetivos
// ---------------------------------------------------------------

export function setObjective(input: {
  company_id: string
  period_month: string
  metric_code: string
  user_id?: string | null
  target_value: number
}) {
  write((db) => {
    const existing = db.objectives.find(
      (o) =>
        o.company_id === input.company_id &&
        o.period_month === input.period_month &&
        o.metric_code === input.metric_code &&
        (o.user_id ?? null) === (input.user_id ?? null),
    )

    if (existing) {
      if (existing.locked) return
      const before = existing.target_value
      existing.target_value = input.target_value
      const metric = db.metrics.find((m) => m.code === input.metric_code)
      audit(db, {
        action: "update",
        entity: "objectives",
        entity_id: existing.id,
        company_id: input.company_id,
        detail: `Cambió la meta de ${metric?.name} de ${before} a ${input.target_value}`,
      })
      return
    }

    if (input.target_value <= 0) return
    db.objectives.push({
      id: uid("ob"),
      company_id: input.company_id,
      period_month: input.period_month,
      metric_code: input.metric_code,
      user_id: input.user_id ?? null,
      target_value: input.target_value,
      locked: false,
    })
    const metric = db.metrics.find((m) => m.code === input.metric_code)
    audit(db, {
      action: "create",
      entity: "objectives",
      company_id: input.company_id,
      detail: `Definió la meta de ${metric?.name} en ${input.target_value}`,
    })
  })
}

export function removeObjective(objectiveId: string) {
  write((db) => {
    const objective = db.objectives.find((o) => o.id === objectiveId)
    if (!objective || objective.locked) return
    db.objectives = db.objectives.filter((o) => o.id !== objectiveId)
    audit(db, {
      action: "delete",
      entity: "objectives",
      entity_id: objectiveId,
      company_id: objective.company_id,
      detail: `Quitó la meta de ${objective.metric_code}`,
    })
  })
}

/** Copia todas las metas de un mes al siguiente, sin sobreescribir las existentes. */
export function copyObjectivesFromPreviousMonth(companyId: string, targetMonth: string): number {
  let copied = 0
  const [y, m] = targetMonth.split("-").map(Number)
  const prevDate = new Date(Date.UTC(y, m - 2, 1))
  const prevMonth = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, "0")}-01`

  write((db) => {
    const source = db.objectives.filter(
      (o) => o.company_id === companyId && o.period_month === prevMonth,
    )
    for (const o of source) {
      const exists = db.objectives.some(
        (x) =>
          x.company_id === companyId &&
          x.period_month === targetMonth &&
          x.metric_code === o.metric_code &&
          (x.user_id ?? null) === (o.user_id ?? null),
      )
      if (exists) continue
      db.objectives.push({ ...o, id: uid("ob"), period_month: targetMonth, locked: false })
      copied++
    }
    if (copied) {
      audit(db, {
        action: "create",
        entity: "objectives",
        company_id: companyId,
        detail: `Copió ${copied} meta(s) de ${prevMonth.slice(0, 7)} a ${targetMonth.slice(0, 7)}`,
      })
    }
  })

  return copied
}

export function setLockMonth(companyId: string, month: string, locked: boolean) {
  write((db) => {
    for (const o of db.objectives) {
      if (o.company_id === companyId && o.period_month === month) o.locked = locked
    }
    audit(db, {
      action: "update",
      entity: "objectives",
      company_id: companyId,
      detail: `${locked ? "Bloqueó" : "Desbloqueó"} los objetivos de ${month.slice(0, 7)}`,
    })
  })
}

// ---------------------------------------------------------------
// Sesión simulada (reemplaza al login mientras no hay Supabase)
// ---------------------------------------------------------------

export function setCurrentUser(userId: string) {
  write((db) => {
    db.current_user_id = userId
  })
}
