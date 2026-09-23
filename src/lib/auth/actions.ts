"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"

export interface ActionState {
  error?: string
  ok?: string
}

/**
 * Entrada con correo y contraseña. No hay registro público ni recuperación por
 * correo: las cuentas y las contraseñas las define el super admin desde
 * /admin/usuarios.
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
