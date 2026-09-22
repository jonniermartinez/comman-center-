"use client"

import { useCallback, useLayoutEffect, useSyncExternalStore } from "react"

import {
  applyTheme,
  onSystemChange,
  readPreference,
  savePreference,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme"

/*
 * Un solo estado a nivel de módulo, compartido por todos los componentes que
 * llamen `useTheme`: el menú de usuario cambia el tema y el Toaster, que
 * vive en otra rama del árbol, se entera sin pasar props.
 */
type Snapshot = { preference: ThemePreference; resolved: ResolvedTheme }

const SERVER_SNAPSHOT: Snapshot = { preference: "sistema", resolved: "light" }
let snapshot: Snapshot = SERVER_SNAPSHOT
const listeners = new Set<() => void>()

function publish(next: Snapshot) {
  snapshot = next
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Estado del tema para componentes cliente.
 *
 * El servidor no sabe la preferencia, así que el primer render asume
 * "sistema" y claro; en `useLayoutEffect` (antes del pintado) se lee lo real.
 * Ese mismo efecto vuelve a aplicar `data-theme`: en desarrollo, el Strict
 * Mode de React remonta la raíz y borra el atributo que puso el script en
 * línea. En producción es una repetición inocua.
 */
export function useTheme() {
  const { preference, resolved } = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => SERVER_SNAPSHOT,
  )

  useLayoutEffect(() => {
    const current = readPreference()
    publish({ preference: current, resolved: applyTheme(current) })
  }, [])

  useLayoutEffect(() => {
    if (preference !== "sistema") return
    return onSystemChange(() =>
      publish({ preference: "sistema", resolved: applyTheme("sistema") }),
    )
  }, [preference])

  const setPreference = useCallback((next: ThemePreference) => {
    savePreference(next)
    publish({ preference: next, resolved: applyTheme(next) })
  }, [])

  return { preference, resolved, setPreference }
}
