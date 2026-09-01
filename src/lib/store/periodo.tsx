"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { createContext, useCallback, useContext } from "react"

import { todayISO } from "@/lib/format"
import { monthOf } from "@/lib/kpi"
import { COOKIE_MES } from "@/lib/store/periodo-cookie"

/**
 * Mes que están mirando todas las pantallas de resumen.
 *
 * Vive en un solo sitio porque el mes no es de una pantalla: se elige agosto y
 * el dashboard, las empresas, las sedes y los objetivos tienen que hablar de
 * agosto. Cada pantalla con su propio selector obligaba a repetir la elección
 * en cada una, y el día 1 de mes todas arrancaban vacías a la vez sin forma
 * evidente de mirar atrás.
 *
 * La elección se guarda en una cookie, no solo en la URL. Colgarle `?mes=` a
 * cada enlace era imposible de sostener: bastaba con entrar a una empresa desde
 * el botón de su tarjeta —o desde el selector de empresa— para volver al mes en
 * curso, y cada enlace nuevo nacía con el mismo agujero. La cookie además la lee
 * el servidor, que es donde se arma el dashboard.
 *
 * La URL sigue mandando cuando trae `?mes=`, para que el enlace a un mes
 * concreto se pueda compartir y abra donde debe.
 */
interface Periodo {
  /** Mes activo en formato `YYYY-MM-01`. */
  mes: string
  setMes: (mes: string) => void
}

const PeriodoContext = createContext<Periodo | null>(null)

export function PeriodoProvider({
  mesInicial,
  children,
}: {
  /** Lo resuelve el servidor leyendo la cookie: así el primer render coincide. */
  mesInicial: string
  children: React.ReactNode
}) {
  const actual = monthOf(todayISO())
  const router = useRouter()
  const params = useSearchParams()

  // La URL manda sobre la cookie, y se lee en vez de copiarse a un estado: así
  // el botón de atrás del navegador devuelve el mes que se estaba viendo.
  const enUrl = params.get("mes")
  const mes = enUrl && /^\d{4}-\d{2}$/.test(enUrl) ? `${enUrl}-01` : mesInicial

  const setMes = useCallback(
    (nuevo: string) => {
      const corto = nuevo.slice(0, 7)
      // Un año de vida: el mes elegido es una preferencia de trabajo, no una
      // sesión. `SameSite=Lax` porque solo la lee esta aplicación.
      document.cookie = `${COOKIE_MES}=${corto}; path=/; max-age=31536000; SameSite=Lax`

      const params = new URLSearchParams(window.location.search)
      if (nuevo === actual) params.delete("mes")
      else params.set("mes", corto)
      const query = params.toString()
      const destino = query
        ? `${window.location.pathname}?${query}`
        : window.location.pathname

      router.replace(destino)
      // La cookie la leen las pantallas de servidor; sin esto el dashboard se
      // quedaría con el mes que trajo del render anterior.
      router.refresh()
    },
    [actual, router],
  )

  return <PeriodoContext.Provider value={{ mes, setMes }}>{children}</PeriodoContext.Provider>
}

export function usePeriodo(): Periodo {
  const ctx = useContext(PeriodoContext)
  if (!ctx) throw new Error("usePeriodo necesita estar dentro de PeriodoProvider")
  return ctx
}
