"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { setKpiTarget } from "@/lib/data/companies-actions"
import { formatNumber, formatPercent } from "@/lib/format"
import type { Kpi } from "@/lib/indicadores"
import { cn } from "@/lib/utils"

/**
 * La meta de un indicador, editable en su sitio para quien administra.
 *
 * Se digita como se lee: 70 para un 70 %, 45 para 45 llamadas. Vacío o cero
 * vuelve a la meta por defecto. Se guarda al salir del campo, igual que los
 * días hábiles, para que no haga falta un botón por tarjeta.
 */
export function MetaEditable({
  companyId,
  kpi,
  editable,
}: {
  companyId: string
  kpi: Kpi
  editable: boolean
}) {
  const porcentaje = kpi.unit === "porcentaje"
  const aTexto = (n: number) => (porcentaje ? String(Math.round(n * 1000) / 10) : String(n))
  const [texto, setTexto] = useState(aTexto(kpi.meta))
  const [pendiente, startTransition] = useTransition()

  const mostrada = porcentaje ? formatPercent(kpi.meta) : formatNumber(kpi.meta)
  const porDefecto = porcentaje ? formatPercent(kpi.metaPorDefecto) : formatNumber(kpi.metaPorDefecto)
  const propia = kpi.meta !== kpi.metaPorDefecto

  if (!editable) {
    return (
      <dd className="text-base font-medium tabular-nums">
        {mostrada}
        {propia && (
          <span className="ml-1 text-[11px] font-normal text-muted-foreground">
            (por defecto {porDefecto})
          </span>
        )}
      </dd>
    )
  }

  function guardar() {
    const n = texto.trim() === "" ? 0 : Number(texto.replace(",", "."))
    if (!Number.isFinite(n) || n < 0 || (porcentaje && n > 1000)) {
      toast.error("La meta no es un número válido.")
      setTexto(aTexto(kpi.meta))
      return
    }
    const meta = porcentaje ? n / 100 : n
    const vuelveAlDefecto = meta === 0 || meta === kpi.metaPorDefecto
    if ((vuelveAlDefecto && !propia) || meta === kpi.meta) {
      setTexto(aTexto(vuelveAlDefecto ? kpi.metaPorDefecto : kpi.meta))
      return
    }
    startTransition(async () => {
      const r = await setKpiTarget(companyId, kpi.code, vuelveAlDefecto ? 0 : meta)
      if (r.ok) {
        toast.success(
          vuelveAlDefecto
            ? `${kpi.nombre}: meta por defecto (${porDefecto}).`
            : `${kpi.nombre}: meta ${porcentaje ? formatPercent(meta) : formatNumber(meta)}.`,
        )
      } else {
        toast.error(r.error ?? "No se pudo guardar la meta.")
        setTexto(aTexto(kpi.meta))
      }
    })
  }

  return (
    <dd className="flex items-baseline gap-1">
      <input
        aria-label={`Meta de ${kpi.nombre}`}
        type="number"
        inputMode="decimal"
        min={0}
        step={porcentaje ? 1 : 0.5}
        value={texto}
        disabled={pendiente}
        title={propia ? `Meta propia. Por defecto ${porDefecto}; vacío vuelve a ella.` : "Vacío deja la meta por defecto."}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={guardar}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className={cn(
          "h-7 w-16 rounded-md border bg-background px-1.5 text-right text-base font-medium tabular-nums",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          propia && "border-primary/60",
        )}
      />
      {porcentaje && <span className="text-sm text-muted-foreground">%</span>}
    </dd>
  )
}
