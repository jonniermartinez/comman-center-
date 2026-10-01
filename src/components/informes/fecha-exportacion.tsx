"use client"

import { useEffect, useState } from "react"
import { flushSync } from "react-dom"

/**
 * Cuándo se sacó el informe.
 *
 * Es la fecha del momento en que se imprime, no la de cuando cargó la página:
 * alguien puede dejar la pestaña abierta toda la tarde. Se fija en
 * `beforeprint`, que también salta si imprimen con Ctrl+P.
 */
export function FechaExportacion() {
  const ahora = () => new Date().toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" })
  const [fecha, setFecha] = useState("")

  useEffect(() => {
    const fijar = () => flushSync(() => setFecha(ahora()))
    window.addEventListener("beforeprint", fijar)
    return () => window.removeEventListener("beforeprint", fijar)
  }, [])

  return <>{fecha}</>
}
