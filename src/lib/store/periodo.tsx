"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { createContext, useCallback, useContext } from "react"

import { todayISO } from "@/lib/format"
import { monthOf } from "@/lib/kpi"

/**
 * Mes que están mirando todas las pantallas de resumen.
 *
 * Vive en un solo sitio porque el mes no es de una pantalla: se elige agosto y
 * el dashboard, las empresas, las sedes y los objetivos tienen que hablar de
 * agosto. Cada pantalla con su propio selector obligaba a repetir la elección
 * en cada una, y el día 1 de mes todas arrancaban vacías a la vez sin forma
 * evidente de mirar atrás.
 *
 * Se refleja en la URL como `?mes=YYYY-MM` porque el dashboard de la empresa se
 * arma en el servidor y un contexto de cliente no le llega. La URL además hace
 * que el enlace a un mes concreto se pueda compartir.
 */
interface Periodo {
  /** Mes activo en formato `YYYY-MM-01`. */
  mes: string
  setMes: (mes: string) => void
  /** Añade `?mes=` a un enlace cuando el mes elegido no es el actual. */
  conMes: (href: string) => string
}

const PeriodoContext = createContext<Periodo | null>(null)

export function PeriodoProvider({ children }: { children: React.ReactNode }) {
  const actual = monthOf(todayISO())
  const router = useRouter()
  const params = useSearchParams()

  // El mes se deriva de la URL en vez de duplicarse en un estado: así el botón
  // de atrás del navegador devuelve el mes que se estaba viendo.
  const enUrl = params.get("mes")
  const mes = enUrl && /^\d{4}-\d{2}$/.test(enUrl) ? `${enUrl}-01` : actual

  const setMes = useCallback(
    (nuevo: string) => {
      const params = new URLSearchParams(window.location.search)
      if (nuevo === actual) params.delete("mes")
      else params.set("mes", nuevo.slice(0, 7))
      const query = params.toString()
      router.replace(query ? `${window.location.pathname}?${query}` : window.location.pathname)
    },
    [actual, router],
  )

  const conMes = useCallback(
    (href: string) => (mes === actual ? href : `${href}?mes=${mes.slice(0, 7)}`),
    [actual, mes],
  )

  return (
    <PeriodoContext.Provider value={{ mes, setMes, conMes }}>{children}</PeriodoContext.Provider>
  )
}

export function usePeriodo(): Periodo {
  const ctx = useContext(PeriodoContext)
  if (!ctx) throw new Error("usePeriodo necesita estar dentro de PeriodoProvider")
  return ctx
}
