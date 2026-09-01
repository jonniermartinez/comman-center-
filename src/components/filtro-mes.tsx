"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { usePeriodo } from "@/lib/store/periodo"

/**
 * Filtro del mes que se está mirando, en la barra superior.
 *
 * Es uno solo para toda la aplicación: el mes se elige una vez y lo obedecen el
 * dashboard, las empresas, las sedes y los objetivos. Sin él, cada pantalla
 * quedaba clavada al mes en curso y el día 1 se veían todas en cero aunque
 * hubiera años de historia detrás.
 */
export function FiltroMes() {
  const { mes, setMes } = usePeriodo()

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="filtro-mes" className="sr-only">
        Mes
      </Label>
      <Input
        id="filtro-mes"
        type="month"
        value={mes.slice(0, 7)}
        onChange={(e) => e.target.value && setMes(`${e.target.value}-01`)}
        className="w-40"
        aria-label="Mes que se está mirando"
      />
    </div>
  )
}
