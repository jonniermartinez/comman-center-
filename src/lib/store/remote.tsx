"use client"

import { createContext, useContext } from "react"

import type { Database } from "./types"

/**
 * Toda la base, tal como la ve la sesión actual.
 *
 * Llega desde el servidor ya resuelta por RLS y se inyecta por contexto —no por
 * una variable de módulo— porque en el render del servidor el módulo se comparte
 * entre peticiones y ahí se filtrarían datos de un usuario a otro.
 */
export const BASE_VACIA: Database = {
  profiles: [],
  companies: [],
  branches: [],
  company_modules: [],
  company_users: [],
  financing_types: [],
  payment_methods: [],
  company_financing_types: [],
  company_payment_methods: [],
  metrics: [],
  daily_kpi: [],
  daily_management: [],
  sales_entries: [],
  billing_entries: [],
  collection_entries: [],
  objectives: [],
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
