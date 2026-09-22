/**
 * Tema claro / oscuro.
 *
 * La preferencia se guarda en localStorage y se aplica como `data-theme` en
 * `<html>` desde un script en línea que corre antes del primer pintado (ver
 * app/layout.tsx). Así no hay parpadeo en blanco al recargar con tema oscuro,
 * y la página se puede seguir prerenderizando estática. Este módulo es la
 * única fuente de verdad de la clave y los valores; el script en línea se
 * genera desde acá para que no se desincronicen.
 */

export const THEME_STORAGE_KEY = "tema"

/** Lo que elige la persona. "sistema" sigue la preferencia del sistema operativo. */
export type ThemePreference = "claro" | "oscuro" | "sistema"

/** Lo que termina aplicado en `<html data-theme>`. */
export type ResolvedTheme = "light" | "dark"

export const THEME_LABELS: Record<ThemePreference, string> = {
  claro: "Claro",
  oscuro: "Oscuro",
  sistema: "Según el sistema",
}

const DARK_QUERY = "(prefers-color-scheme: dark)"

function isPreference(value: unknown): value is ThemePreference {
  return value === "claro" || value === "oscuro" || value === "sistema"
}

export function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return isPreference(stored) ? stored : "sistema"
  } catch {
    return "sistema"
  }
}

export function resolve(preference: ThemePreference): ResolvedTheme {
  if (preference === "oscuro") return "dark"
  if (preference === "claro") return "light"
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light"
}

/** Escribe `data-theme` en `<html>`; devuelve lo que quedó aplicado. */
export function applyTheme(preference: ThemePreference): ResolvedTheme {
  const resolved = resolve(preference)
  document.documentElement.setAttribute("data-theme", resolved)
  return resolved
}

export function savePreference(preference: ThemePreference) {
  try {
    if (preference === "sistema") localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // Sin almacenamiento (modo privado, datos bloqueados): el tema aplica
    // igual en esta pestaña, solo no se recuerda.
  }
}

/** Avisa cuando cambia la preferencia del sistema; solo importa en "sistema". */
export function onSystemChange(callback: () => void) {
  const media = window.matchMedia(DARK_QUERY)
  media.addEventListener("change", callback)
  return () => media.removeEventListener("change", callback)
}

/**
 * Script que corre en `<head>` durante el parseo del HTML. Es la misma lógica
 * que `resolve` + `applyTheme`, escrita en JavaScript plano porque no puede
 * importar nada. El `try` cubre localStorage bloqueado.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var d=t==="oscuro"||(t!=="claro"&&matchMedia(${JSON.stringify(DARK_QUERY)}).matches);document.documentElement.setAttribute("data-theme",d?"dark":"light")}catch(e){}})()`
