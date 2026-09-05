"use server"

import { revalidatePath } from "next/cache"

import { logAudit } from "@/lib/data/audit"
import { requireSuperAdmin } from "@/lib/auth/session"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/database.types"

type UserRole = Database["public"]["Enums"]["user_role"]

export interface Result {
  ok: boolean
  error?: string
}

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
}

/**
 * Cliente de Auth sin cookies, con la clave publicable.
 *
 * Sirve para pedirle a Auth un correo en nombre de otra persona (el enlace de
 * la invitación) sin que esa llamada pise la sesión del super admin que vive en
 * las cookies de la petición. No salta nada: es la misma clave del navegador.
 */
function createMailClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
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
 * Crea la cuenta y manda la invitación por correo.
 *
 * El perfil no se inserta acá: lo crea el trigger `on_auth_user_created` a
 * partir de la metadata, así una cuenta creada desde el panel de Supabase
 * también nace con perfil y no queda a medias.
 */
export async function inviteUser(input: {
  full_name: string
  email: string
  phone?: string
  role: UserRole
  company_ids: string[]
}): Promise<Result> {
  await requireSuperAdmin()

  const email = input.email.trim().toLowerCase()
  const full_name = input.full_name.trim()
  if (full_name.length < 3) return { ok: false, error: "El nombre es demasiado corto." }
  if (!/.+@.+\..+/.test(email)) return { ok: false, error: "El correo no es válido." }

  // La cuenta nace en la base, invitada y sin contraseña utilizable. La crea
  // la función `admin_create_user` de Postgres, que vuelve a verificar que
  // quien llama es super admin: no hay clave de servicio de por medio.
  //
  // `p_invitado`: el correo queda confirmado desde el inicio. Sin eso, Auth
  // trata la cuenta como un registro a medias y se niega a mandarle el enlace
  // ("Signups not allowed"). Entrar sigue siendo imposible sin el enlace: la
  // contraseña es aleatoria y nadie la conoce.
  const supabase = await createClient()
  const { data: userId, error } = await supabase.rpc("admin_create_user", {
    p_email: email,
    p_full_name: full_name,
    p_role: input.role,
    p_phone: input.phone?.trim() || undefined,
    p_invitado: true,
  })

  if (error || !userId) {
    return { ok: false, error: error?.message ?? "No se pudo crear el usuario." }
  }

  const asignacion = await asignarEmpresas(userId, input.company_ids, input.role)
  if (!asignacion.ok) return asignacion

  const envio = await enviarEnlace(email)
  if (!envio.ok) {
    return { ok: false, error: `La cuenta quedó creada, pero ${envio.error}` }
  }

  await logAudit({
    action: "create",
    entity: "profiles",
    entity_id: userId,
    after: { full_name, email, role: input.role, empresas: input.company_ids.length },
  })

  refrescar()
  return { ok: true }
}

/**
 * Manda el enlace de un solo uso para entrar y definir la contraseña: el
 * mismo de "olvidé mi clave", solo que lo dispara el super admin. Al
 * canjearlo, Auth registra el primer inicio de sesión y el perfil pasa de
 * invitado a activo.
 */
async function enviarEnlace(email: string): Promise<Result> {
  const { error } = await createMailClient().auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${siteUrl()}/auth/confirm?next=/definir-clave`,
    },
  })
  if (!error) return { ok: true }

  const msg = error.message.toLowerCase()
  if (msg.includes("rate limit")) {
    return {
      ok: false,
      error:
        "Supabase limitó el envío de correos. Configura un SMTP propio o reintenta en unos minutos.",
    }
  }
  if (msg.includes("signups not allowed")) {
    return {
      ok: false,
      error:
        "Auth no reconoce la cuenta como invitada (correo sin confirmar). Aplica la migración 031 y reintenta.",
    }
  }
  return { ok: false, error: `el correo no salió: ${error.message}` }
}

/**
 * Vuelve a mandar la invitación a quien todavía no ha entrado. El enlace
 * anterior queda inservible: Auth solo honra el último.
 */
export async function resendInvite(userId: string): Promise<Result> {
  await requireSuperAdmin()
  const supabase = await createClient()

  const { data: perfil } = await supabase
    .from("profiles")
    .select("email, status, full_name")
    .eq("id", userId)
    .single()

  if (!perfil) return { ok: false, error: "El usuario no existe." }
  if (perfil.status !== "invitado") {
    return { ok: false, error: "Esta cuenta ya está activa: no necesita invitación." }
  }
  if (perfil.email.endsWith(`.${DOMINIO_PROVISIONAL}`)) {
    return { ok: false, error: "Es una cuenta provisional: ese correo no existe." }
  }

  const envio = await enviarEnlace(perfil.email)
  if (!envio.ok) return { ok: false, error: `No se pudo reenviar: ${envio.error}` }

  await logAudit({
    action: "update",
    entity: "profiles",
    entity_id: userId,
    after: { invitacion_reenviada: perfil.email },
  })

  return { ok: true }
}

/**
 * Asigna al usuario a varias empresas con el mismo rol.
 *
 * Un asesor no puede quedar sin sede (lo impide la restricción
 * `company_users_asesor_con_sede`), así que entra en la sede principal y desde
 * el equipo de la empresa se le mueve si hace falta.
 */
async function asignarEmpresas(
  userId: string,
  companyIds: string[],
  role: UserRole,
): Promise<Result> {
  if (role === "super_admin" || companyIds.length === 0) return { ok: true }

  const supabase = await createClient()
  const rolEnEmpresa = role === "coordinador" ? "coordinador" : "asesor"

  const { data: sedes } = await supabase
    .from("branches")
    .select("id, company_id, is_primary")
    .in("company_id", companyIds)
    .eq("status", "activa")

  const filas = companyIds.map((company_id) => {
    const deLaEmpresa = (sedes ?? []).filter((b) => b.company_id === company_id)
    const principal = deLaEmpresa.find((b) => b.is_primary) ?? deLaEmpresa[0]
    return {
      company_id,
      user_id: userId,
      role: rolEnEmpresa as UserRole,
      branch_id: principal?.id ?? null,
      removed_at: null,
    }
  })

  const sinSede = filas.find((f) => rolEnEmpresa === "asesor" && !f.branch_id)
  if (sinSede) {
    return { ok: false, error: "Una de las empresas no tiene sedes activas. Crea una primero." }
  }

  const { error } = await supabase
    .from("company_users")
    .upsert(filas, { onConflict: "company_id,user_id" })

  return error ? { ok: false, error: error.message } : { ok: true }
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
 * Deja al usuario exactamente en las empresas indicadas.
 *
 * Lo que se quita no se borra: se marca `removed_at`. El usuario deja de ver la
 * empresa, pero sus registros previos siguen atados a ella y los reportes
 * históricos no cambian.
 */
export async function setUserCompanies(
  userId: string,
  asignaciones: { company_id: string; role: "coordinador" | "asesor" }[],
): Promise<Result> {
  const session = await requireSuperAdmin()
  const supabase = await createClient()

  const companyIds = asignaciones.map((a) => a.company_id)

  // Un asesor no puede quedar sin sede: entra en la principal de cada empresa y
  // desde el equipo de la empresa se le mueve si hace falta.
  const { data: sedes } = companyIds.length
    ? await supabase
        .from("branches")
        .select("id, company_id, is_primary")
        .in("company_id", companyIds)
        .eq("status", "activa")
    : { data: [] }

  const { data: actuales } = await supabase
    .from("company_users")
    .select("company_id, branch_id")
    .eq("user_id", userId)

  const filas = asignaciones.map((a) => {
    const deLaEmpresa = (sedes ?? []).filter((b) => b.company_id === a.company_id)
    const actual = (actuales ?? []).find((c) => c.company_id === a.company_id)
    const principal = deLaEmpresa.find((b) => b.is_primary) ?? deLaEmpresa[0]
    return {
      company_id: a.company_id,
      user_id: userId,
      role: a.role,
      // Se respeta la sede que ya tenía; solo se resuelve una si no hay.
      branch_id: actual?.branch_id ?? principal?.id ?? null,
      removed_at: null,
      assigned_by: session.profile.id,
    }
  })

  const sinSede = filas.find((f) => f.role === "asesor" && !f.branch_id)
  if (sinSede) {
    return { ok: false, error: "Una de las empresas no tiene sedes activas. Crea una primero." }
  }

  if (filas.length) {
    const { error } = await supabase
      .from("company_users")
      .upsert(filas, { onConflict: "company_id,user_id" })
    if (error) return { ok: false, error: error.message }
  }

  // Las que ya no están seleccionadas salen, sin borrar la fila.
  const quitar = (actuales ?? [])
    .map((c) => c.company_id)
    .filter((id) => !companyIds.includes(id))

  if (quitar.length) {
    const { error } = await supabase
      .from("company_users")
      .update({ removed_at: new Date().toISOString() })
      .eq("user_id", userId)
      .in("company_id", quitar)
      .is("removed_at", null)
    if (error) return { ok: false, error: error.message }
  }

  await logAudit({
    action: "assign",
    entity: "company_users",
    entity_id: userId,
    after: { empresas: filas.length, quitadas: quitar.length },
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


