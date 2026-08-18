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
 * Entrada con correo y contraseña. No hay registro público: las cuentas las
 * crea el super admin desde /admin/usuarios.
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
    // No se distingue "correo inexistente" de "contraseña incorrecta": decirlo
    // permitiría averiguar qué correos tienen cuenta en la plataforma.
    return { error: "Correo o contraseña incorrectos." }
  }

  revalidatePath("/", "layout")
  redirect(next)
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
