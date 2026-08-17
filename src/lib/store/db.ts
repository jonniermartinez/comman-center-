"use client"

import { buildSeedDatabase, SEED_VERSION } from "./seed"
import type { Database } from "./types"

/**
 * Persistencia en localStorage. Es la capa temporal.
 *
 * OJO: `read()` es síncrona y devuelve la base completa, y así la consumen los
 * hooks en toda la app. Pasar a Supabase no es reemplazar solo este archivo:
 * obliga a introducir asincronía (queries por página, estados de carga y error,
 * revalidación tras escribir) en los ~16 archivos que usan `useDb()`.
 */

const KEY = "command-center-db"

let cache: Database | null = null
const listeners = new Set<() => void>()

function isBrowser() {
  return typeof window !== "undefined"
}

/**
 * Completa con el seed las tablas que falten en lo guardado.
 *
 * No basta con comparar la versión: si el esquema gana una tabla nueva y algún
 * navegador ya guardó datos con la versión nueva pero sin ella, `db.tabla` sale
 * `undefined` y la app revienta al hacer `.filter`. Acá se garantiza que la
 * forma siempre esté completa, conservando los datos que el usuario ya tenía.
 */
function reconciliar(guardado: Partial<Database>): Database {
  const base = buildSeedDatabase()
  // Se escribe sobre una copia sin tipar y se devuelve como Database: TypeScript
  // no puede estrechar el tipo de un valor indexado por una clave dinámica.
  const resultado: Record<string, unknown> = { ...base }

  for (const clave of Object.keys(base) as (keyof Database)[]) {
    const valor = guardado[clave]
    if (valor === undefined || valor === null) continue
    // Una tabla guardada debe seguir siendo un arreglo para poder usarse.
    if (Array.isArray(base[clave]) && !Array.isArray(valor)) continue
    resultado[clave] = valor
  }

  return resultado as unknown as Database
}

export function read(): Database {
  if (cache) return cache
  if (!isBrowser()) return buildSeedDatabase()

  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Database>
      // Si el seed cambió de versión, se descarta lo guardado y se resiembra.
      if (parsed.version === SEED_VERSION) {
        cache = reconciliar(parsed)
        return cache
      }
    }
  } catch {
    // JSON corrupto: se resiembra en vez de dejar la app rota.
  }

  cache = buildSeedDatabase()
  persist(cache)
  return cache
}

function persist(db: Database) {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    // Cuota excedida: la sesión sigue en memoria.
  }
}

/** Aplica un cambio inmutable y notifica a los componentes suscritos. */
export function write(mutate: (db: Database) => Database | void): Database {
  const current = read()
  const draft: Database = structuredClone(current)
  const result = mutate(draft) ?? draft
  cache = result
  persist(result)
  listeners.forEach((fn) => fn())
  return result
}

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSnapshot(): Database {
  return read()
}

/** Snapshot estable para el render del servidor (evita el mismatch de hidratación). */
let serverSnapshot: Database | null = null
export function getServerSnapshot(): Database {
  serverSnapshot ??= buildSeedDatabase()
  return serverSnapshot
}

export function resetDatabase() {
  cache = buildSeedDatabase()
  persist(cache)
  listeners.forEach((fn) => fn())
}

export function exportDatabase(): string {
  return JSON.stringify(read(), null, 2)
}
