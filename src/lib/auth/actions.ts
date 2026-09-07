"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"

export interface ActionState {
  error?: string
  ok?: string
}

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
}

/**
 * Entrada con correo y contraseña. La cuenta se la crea cada quien en
 * /registro; el super admin también puede crearla desde /admin/usuarios.
 */
export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")
  const next = String(formData.get("next") ?? "") || "/empresas"

  if (!email || !password) {
    return { error: "Escribe tu correo y tu contraseña." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Cuenta creada pero sin confirmar: le falta el código, no la contraseña.
    if (error.message.toLowerCase().includes("not confirmed")) {
      redirect(`/verificar?email=${encodeURIComponent(email)}`)
    }
    // No se distingue "correo inexistente" de "contraseña incorrecta": decirlo
    // permitiría averiguar qué correos tienen cuenta en la plataforma.
    return { error: "Correo o contraseña incorrectos." }
  }

  revalidatePath("/", "layout")
  redirect(next)
}

function correoValido(email: string) {
  return /.+@.+\..+/.test(email)
}

/**
 * Crea la cuenta con correo y contraseña. Auth manda un código de seis
 * dígitos al correo; hasta que no lo confirme en /verificar la cuenta no
 * tiene sesión. Nace como asesor sin empresas: el trigger de la base ignora
 * cualquier rol que venga en la metadata de un alta pública.
 */
export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const fullName = String(formData.get("full_name") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")
  const confirm = String(formData.get("confirm") ?? "")

  if (!fullName) return { error: "Escribe tu nombre." }
  if (!correoValido(email)) return { error: "El correo no es válido." }
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." }
  if (password !== confirm) return { error: "Las dos contraseñas no coinciden." }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })

  if (error) {
    if (error.message.toLowerCase().includes("rate limit")) {
      return { error: "Se enviaron demasiados correos seguidos. Espera unos minutos y reintenta." }
    }
    if (error.message.toLowerCase().includes("signups not allowed")) {
      return { error: "El registro está cerrado. Pídele la cuenta al administrador." }
    }
    return { error: "No se pudo crear la cuenta. Reintenta en un momento." }
  }

  // Con la confirmación de correo encendida, Auth no abre sesión acá: la
  // abre /verificar al canjear el código. Si el correo ya tenía cuenta, Auth
  // devuelve un usuario sin identidades y no manda nada; se sigue igual para
  // no revelar qué correos existen.
  if (data.session) {
    revalidatePath("/", "layout")
    redirect("/empresas")
  }

  redirect(`/verificar?email=${encodeURIComponent(email)}`)
}

/** Canjea el código de seis dígitos que llegó al correo y abre sesión. */
export async function verifyEmailCode(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const token = String(formData.get("token") ?? "").replace(/\D/g, "")

  if (!correoValido(email)) return { error: "El correo no es válido." }
  if (token.length !== 6) return { error: "El código tiene seis dígitos." }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "signup" })

  if (error) {
    return { error: "El código no es válido o ya caducó. Pide uno nuevo." }
  }

  revalidatePath("/", "layout")
  redirect("/empresas")
}

/** Vuelve a mandar el código de confirmación. */
export async function resendSignupCode(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  if (!correoValido(email)) return { error: "El correo no es válido." }

  const supabase = await createClient()
  const { error } = await supabase.auth.resend({ type: "signup", email })

  if (error?.message.toLowerCase().includes("rate limit")) {
    return { error: "Se enviaron demasiados correos seguidos. Espera unos minutos y reintenta." }
  }
  // Misma respuesta exista o no la cuenta, por la misma razón que en recuperar.
  return { ok: "Si ese correo está pendiente de confirmar, le llega un código nuevo." }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  redirect("/login")
}

/** Define o cambia la contraseña del usuario en sesión. */
export async function updatePassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const password = String(formData.get("password") ?? "")
  const confirm = String(formData.get("confirm") ?? "")

  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." }
  if (password !== confirm) return { error: "Las dos contraseñas no coinciden." }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "El enlace expiró. Pide una invitación nueva." }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }

  revalidatePath("/", "layout")
  redirect("/empresas")
}

/** Envía el correo para restablecer la contraseña. */
export async function requestPasswordReset(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  if (!email) return { error: "Escribe tu correo." }

  const supabase = await createClient()
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/confirm?next=/definir-clave`,
  })

  // Siempre la misma respuesta, exista o no la cuenta: si no, este formulario
  // serviría para averiguar quién tiene usuario.
  return { ok: "Si ese correo tiene cuenta, le llegará un enlace para entrar." }
}
