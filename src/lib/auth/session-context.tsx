"use client"

import { createContext, useContext } from "react"

import type { Profile } from "@/lib/store/types"

/**
 * La sesión real, resuelta en el servidor y bajada al cliente.
 *
 * Sustituye al selector de usuario de la etapa de prototipo: ahora quién eres
 * lo decide el token de Supabase, no un valor guardado en el navegador.
 */
export interface ClientSession {
  profile: Profile
  isSuperAdmin: boolean
  /** Activo y con perfil. Un invitado o un suspendido entra pero no lee nada. */
  isActive: boolean
}

const SIN_SESION: ClientSession = {
  profile: {
    id: "",
    full_name: "Sin sesión",
    email: "",
    role: "asesor",
    status: "inactivo",
    created_at: new Date(0).toISOString(),
  },
  isSuperAdmin: false,
  isActive: false,
}

const SessionContext = createContext<ClientSession>(SIN_SESION)

export function SessionProvider({
  value,
  children,
}: {
  value: ClientSession
  children: React.ReactNode
}) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): ClientSession {
  return useContext(SessionContext)
}
