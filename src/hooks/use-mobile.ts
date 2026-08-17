import * as React from "react"

const MOBILE_BREAKPOINT = 768
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

/**
 * Se lee del media query con useSyncExternalStore en vez de sincronizar estado
 * en un efecto: así no hay render extra ni desfase en el primer pintado.
 */
export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    // En el servidor no hay viewport: se asume escritorio y el cliente corrige.
    () => false,
  )
}
