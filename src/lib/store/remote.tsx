"use client"

import { createContext, useContext } from "react"

import type { Database } from "./types"

/**
 * Los datos de referencia de la sesión.
 *
 * Llegan del servidor ya resueltos por RLS y se inyectan por contexto —no por
 * una variable de módulo— porque en el render del servidor el módulo se
 * comparte entre peticiones y ahí se filtrarían datos de un usuario a otro.
 */
export const BASE_VACIA: Database = {
  profiles: [],
  staff: [],
  company_staff: [],
  companies: [],
  branches: [],
  company_modules: [],
  company_users: [],
  financing_types: [],
  payment_methods: [],
  company_financing_types: [],
  company_payment_methods: [],
  products: [],
  schools: [],
  channels: [],
  sale_states: [],
  cash_concepts: [],
  metrics: [],
}

const RemoteContext = createContext<Database>(BASE_VACIA)

export function RemoteProvider({
  value,
  children,
}: {
  value: Database
  children: React.ReactNode
}) {
  return <RemoteContext.Provider value={value}>{children}</RemoteContext.Provider>
}

export function useRemote(): Database {
  return useContext(RemoteContext)
}
