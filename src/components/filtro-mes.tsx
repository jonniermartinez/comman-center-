"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { monthLabel } from "@/lib/kpi"
import { usePeriodo } from "@/lib/store/periodo"

/** Suma meses a un `YYYY-MM-01` sin que se desmadre el cambio de año. */
function correr(mes: string, meses: number): string {
  const [y, m] = mes.split("-").map(Number)
  const d = new Date(Date.UTC(y, m - 1 + meses, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`
}

/**
 * Filtro del mes que se está mirando, en la barra superior.
 *
 * Es uno solo para toda la aplicación: el mes se elige una vez y lo obedecen el
 * dashboard, las empresas, las sedes y los objetivos. Sin él, cada pantalla
 * quedaba clavada al mes en curso y el día 1 se veían todas en cero aunque
 * hubiera años de historia detrás.
 *
 * Las flechas son el gesto principal —revisar es casi siempre ir al mes
 * anterior— y el nombre del mes abre el calendario nativo para saltos largos.
 * El `input` va invisible encima del nombre en vez de a la vista porque el
 * control de mes del navegador se pinta a su aire, con el año recortado y un
 * icono que no es de esta interfaz.
 */
export function FiltroMes() {
  const { mes, setMes } = usePeriodo()

  return (
    <div className="flex items-center rounded-md border bg-background">
      <Button
        variant="ghost"
        size="icon"
        className="size-8 rounded-r-none"
        onClick={() => setMes(correr(mes, -1))}
        aria-label="Mes anterior"
      >
        <ChevronLeft className="size-4" />
      </Button>

      <div className="relative">
        <span className="block min-w-36 px-1 text-center text-sm font-medium tabular-nums">
          {monthLabel(mes)}
        </span>
        <input
          type="month"
          value={mes.slice(0, 7)}
          onChange={(e) => e.target.value && setMes(`${e.target.value}-01`)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Elegir mes"
        />
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="size-8 rounded-l-none"
        onClick={() => setMes(correr(mes, 1))}
        aria-label="Mes siguiente"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}
