"use server"

import { revalidatePath } from "next/cache"

import { logAudit } from "@/lib/data/audit"
import { requireSuperAdmin } from "@/lib/auth/session"

import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/database.types"

type UserRole = Database["public"]["Enums"]["user_role"]

export interface Result {
  ok: boolean
  error?: string
  /** Aviso para el toast cuando salió bien pero no como se esperaba. */
  mensaje?: string
}

/**
 * Bloquea o desbloquea el inicio de sesión en Auth.
 *
 * Lo hace la función `admin_ban_user` de Postgres, llamada con la sesión del
 * usuario: la base vuelve a verificar que quien lo pide es super admin.
 * Complementa a RLS, que ya niega los datos por el estado del perfil.
 */
async function bloquearEnAuth(userId: string, bloquear: boolean) {
  const supabase = await createClient()
  const { error } = await supabase.rpc("admin_ban_user", {
    target_user: userId,
    bloquear,
  })
  // La baja o suspensión ya quedó en el perfil, que es lo que RLS mira; si el
  // bloqueo del login falló se avisa sin tumbar la acción.
  if (error) console.error("admin_ban_user:", error.message)
}

function refrescar() {
  revalidatePath("/admin/usuarios")
  revalidatePath("/", "layout")
}

/**
 * Crea la cuenta con nombre, correo, contraseña y rol. Sin correo de por
 * medio: la contraseña la escribe el super admin y se la dicta a la persona.
 *
 * El perfil no se inserta acá: lo crea el trigger `on_auth_user_created` a
 * partir de la metadata. La cuenta la crea `admin_create_user` en Postgres,
 * que vuelve a verificar que quien llama es super admin.
 *
 * Si el correo ya tiene cuenta no se crea otra: se saca de eliminados si
 * hacía falta, se actualizan sus datos y se le pone la contraseña.
 */
export async function createUser(input: {
  full_name: string
  email: string
  phone?: string
  role: UserRole
  password: string
}): Promise<Result> {
  await requireSuperAdmin()

  const email = input.email.trim().toLowerCase()
  const full_name = input.full_name.trim()
  if (full_name.length < 3) return { ok: false, error: "El nombre es demasiado corto." }
  if (!/.+@.+\..+/.test(email)) return { ok: false, error: "El correo no es válido." }
  if (input.password.length < 8) {
    return { ok: false, error: "La contraseña debe tener al menos 8 caracteres." }
  }

  const supabase = await createClient()

  const { data: existente } = await supabase
    .from("profiles")
    .select("id, deleted_at")
    .eq("email", email)
    .maybeSingle()

  if (existente) {
    if (existente.deleted_at) {
      const restauro = await restoreUser(existente.id)
      if (!restauro.ok) return restauro
    }
    const datos = await updateUserProfile(existente.id, { full_name, phone: input.phone })
    if (!datos.ok) return datos
    const clave = await setUserPassword(existente.id, input.password)
    if (!clave.ok) return clave

    refrescar()
    return {
      ok: true,
      mensaje: existente.deleted_at
        ? "Ya existía y estaba eliminada: se restauró con la contraseña nueva."
        : "Ya existía: se le puso la contraseña nueva.",
    }
  }

  const { data: userId, error } = await supabase.rpc("admin_create_user", {
    p_email: email,
    p_full_name: full_name,
    p_role: input.role,
    p_phone: input.phone?.trim() || undefined,
    p_password: input.password,
    p_confirmado: true,
  })

  if (error || !userId) {
    return { ok: false, error: error?.message ?? "No se pudo crear el usuario." }
  }

  await logAudit({
    action: "create",
    entity: "profiles",
    entity_id: userId,
    after: { full_name, email, role: input.role },
  })

  refrescar()
  return { ok: true }
}

/**
 * Le pone una contraseña nueva a una cuenta. Es la única forma de recuperar
 * el acceso cuando alguien la olvida: no hay correo. Lo hace
 * `admin_set_password` en Postgres, solo para el super admin.
 */
export async function setUserPassword(userId: string, password: string): Promise<Result> {
  await requireSuperAdmin()
  if (password.length < 8) {
    return { ok: false, error: "La contraseña debe tener al menos 8 caracteres." }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc("admin_set_password", {
    target_user: userId,
    p_password: password,
  })
  if (error) return { ok: false, error: error.message }

  await logAudit({
    action: "update",
    entity: "profiles",
    entity_id: userId,
    after: { contrasena_definida: true },
  })

  refrescar()
  return { ok: true }
}

/**
 * Cambia el correo de una cuenta.
 *
 * Es lo que cierra el flujo de las cuentas provisionales: alguien nació con un
 * usuario terminado en `.invalid` y ahora sí mandó su correo. Cambiarlo no
 * mueve nada más —la cuenta conserva su identificador— así que su histórico,
 * sus empresas y sus metas siguen donde estaban. Lo hace `admin_change_email`
 * en Postgres, que vuelve a verificar que quien llama es super admin.
 */
export async function changeUserEmail(userId: string, email: string): Promise<Result> {
  await requireSuperAdmin()

  const correo = email.trim().toLowerCase()
  if (!/.+@.+\..+/.test(correo)) return { ok: false, error: "El correo no es válido." }
  if (esProvisional(correo)) return { ok: false, error: "Ese correo es provisional." }

  const supabase = await createClient()
  const { data: antes } = await supabase.from("profiles").select("email").eq("id", userId).single()
  if (!antes) return { ok: false, error: "El usuario no existe." }
  if (antes.email === correo) return { ok: true }

  const { error } = await supabase.rpc("admin_change_email", { target_user: userId, p_email: correo })
  if (error) {
    if (error.message.includes("Ya existe")) {
      return { ok: false, error: "Ya hay una cuenta con ese correo." }
    }
    return { ok: false, error: error.message }
  }

  await logAudit({
    action: "update",
    entity: "profiles",
    entity_id: userId,
    before: { email: antes.email },
    after: { email: correo },
  })

  refrescar()
  return { ok: true }
}

/** Cambia el rol global. El super admin no puede degradarse a sí mismo. */
export async function setUserRole(userId: string, role: UserRole): Promise<Result> {
  const session = await requireSuperAdmin()
  if (userId === session.profile.id) {
    return { ok: false, error: "No puedes cambiar tu propio rol." }
  }

  const supabase = await createClient()
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId)
  if (error) return { ok: false, error: error.message }

  await logAudit({
    action: "update",
    entity: "profiles",
    entity_id: userId,
    after: { role },
  })

  refrescar()
  return { ok: true }
}

/**
 * Suspende o reactiva el acceso.
 *
 * Son dos cosas a la vez y las dos hacen falta: el estado del perfil es lo que
 * miran las políticas RLS (`is_active_user()`), y el bloqueo en Auth es lo que
 * impide que siquiera pueda iniciar sesión.
 */
export async function setUserActive(userId: string, activo: boolean): Promise<Result> {
  const session = await requireSuperAdmin()
  if (userId === session.profile.id) {
    return { ok: false, error: "No puedes suspenderte a ti mismo." }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("profiles")
    .update({ status: activo ? "activo" : "inactivo" })
    .eq("id", userId)
  if (error) return { ok: false, error: error.message }

  // El estado del perfil ya cerró el acceso a los datos (RLS mira
  // `is_active_user()`); el bloqueo en Auth impide además iniciar sesión.
  await bloquearEnAuth(userId, !activo)

  await logAudit({
    action: "update",
    entity: "profiles",
    entity_id: userId,
    after: { status: activo ? "activo" : "inactivo" },
  })

  refrescar()
  return { ok: true }
}

/**
 * Baja lógica: revoca el acceso y conserva el histórico a su nombre.
 * La regla vive en la función `soft_delete_user` de la base, no acá.
 */
export async function deleteUser(userId: string): Promise<Result> {
  await requireSuperAdmin()

  const supabase = await createClient()
  const { error } = await supabase.rpc("soft_delete_user", { target_user: userId })
  if (error) return { ok: false, error: error.message }

  await bloquearEnAuth(userId, true)

  refrescar()
  return { ok: true }
}

export async function restoreUser(userId: string): Promise<Result> {
  await requireSuperAdmin()

  const supabase = await createClient()
  const { error } = await supabase.rpc("restore_user", { target_user: userId })
  if (error) return { ok: false, error: error.message }

  await bloquearEnAuth(userId, false)

  refrescar()
  return { ok: true }
}

/** Datos básicos del perfil. El rol y el estado tienen sus propias acciones. */
export async function updateUserProfile(
  userId: string,
  patch: { full_name: string; phone?: string },
): Promise<Result> {
  await requireSuperAdmin()

  const full_name = patch.full_name.trim()
  if (full_name.length < 3) return { ok: false, error: "El nombre es demasiado corto." }

  const supabase = await createClient()
  const { error } = await supabase
    .from("profiles")
    .update({ full_name, phone: patch.phone?.trim() || null })
    .eq("id", userId)
  if (error) return { ok: false, error: error.message }

  await logAudit({
    action: "update",
    entity: "profiles",
    entity_id: userId,
    after: { full_name },
  })

  refrescar()
  return { ok: true }
}

/**
 * Dominio de los correos provisionales.
 *
 * `.invalid` está reservado por la RFC 2606 justamente para esto: no existe ni
 * puede existir, así que ninguna de estas direcciones va a chocar con la de una
 * persona real ni va a mandar correo a un desconocido por un dedazo.
 */
const DOMINIO_PROVISIONAL = "invalid"

function esProvisional(email: string) {
  return email.toLowerCase().endsWith(`.${DOMINIO_PROVISIONAL}`)
}

/** Usuario a partir del nombre: "Patiño Erika" → "patino.erika". */
function usuarioDesde(nombre: string) {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
}

/** Contraseña temporal legible: se dicta por teléfono sin equivocarse. */
function claveTemporal() {
  const silabas = ["ta", "re", "mi", "sol", "lu", "pa", "ce", "no", "vi", "ka"]
  const palabra = Array.from(
    { length: 3 },
    () => silabas[Math.floor(Math.random() * silabas.length)],
  ).join("")
  const numero = Math.floor(1000 + Math.random() * 9000)
  return `${palabra.charAt(0).toUpperCase()}${palabra.slice(1)}${numero}*`
}

export interface CuentaCreada {
  staff_id: string
  full_name: string
  usuario: string
  clave: string
}

/**
 * Crea las cuentas del equipo de una empresa sin esperar los correos.
 *
 * Entran con un usuario provisional y una contraseña temporal, y quedan
 * enlazadas con la persona: desde el primer momento cada quien ve **su**
 * histórico, porque lo que ata los registros es el identificador de la persona,
 * no su correo.
 *
 * El correo provisional se queda: cambiarlo se quitó de la aplicación. Si algún
 * día hace falta, se hace en la base y el identificador de la cuenta no cambia,
 * así que su histórico y sus empresas siguen donde estaban.
 */
export async function createStaffAccounts(
  companyId: string,
  staffIds?: string[],
): Promise<Result & { cuentas?: CuentaCreada[] }> {
  const session = await requireSuperAdmin()
  const supabase = await createClient()

  const { data: empresa } = await supabase
    .from("companies")
    .select("slug")
    .eq("id", companyId)
    .single()
  if (!empresa) return { ok: false, error: "La empresa no existe." }

  const { data: equipo } = await supabase
    .from("company_staff")
    .select("staff_id, branch_id, staff(id, full_name, profile_id, active)")
    .eq("company_id", companyId)

  const pendientes = (equipo ?? [])
    .filter((cs) => cs.staff?.active && !cs.staff.profile_id)
    .filter((cs) => !staffIds?.length || staffIds.includes(cs.staff_id))

  if (pendientes.length === 0) {
    return { ok: true, cuentas: [] }
  }

  const cuentas: CuentaCreada[] = []
  const usados = new Set<string>()

  for (const cs of pendientes) {
    const persona = cs.staff!
    let usuario = usuarioDesde(persona.full_name)
    // Dos personas distintas pueden reducirse al mismo usuario; se desempata.
    let intento = 1
    while (usados.has(usuario)) usuario = `${usuarioDesde(persona.full_name)}${++intento}`
    usados.add(usuario)

    const correo = `${usuario}@${empresa.slug}.${DOMINIO_PROVISIONAL}`
    const clave = claveTemporal()

    // `p_confirmado`: sin esto la cuenta nace "invitada" y no puede entrar
    // hasta confirmar un correo que nunca va a llegar.
    const { data: userId, error } = await supabase.rpc("admin_create_user", {
      p_email: correo,
      p_full_name: persona.full_name,
      p_role: "asesor",
      p_password: clave,
      p_confirmado: true,
    })

    if (error || !userId) {
      console.error("crear cuenta", persona.full_name, error?.message)
      continue
    }

    await Promise.all([
      supabase.from("staff").update({ profile_id: userId }).eq("id", persona.id),
      supabase.from("company_users").upsert(
        {
          company_id: companyId,
          user_id: userId,
          role: "asesor" as const,
          branch_id: cs.branch_id,
          removed_at: null,
          assigned_by: session.profile.id,
        },
        { onConflict: "company_id,user_id" },
      ),
    ])

    cuentas.push({ staff_id: persona.id, full_name: persona.full_name, usuario: correo, clave })
  }

  await logAudit({
    action: "create",
    entity: "profiles",
    company_id: companyId,
    after: { cuentas_creadas: cuentas.length },
  })

  refrescar()
  return { ok: true, cuentas }
}


