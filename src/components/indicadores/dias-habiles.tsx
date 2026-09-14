"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { setBusinessDays } from "@/lib/data/companies-actions"
import { monthLabel } from "@/lib/kpi"

/**
 * Cuántos días hábiles tiene el mes para esta empresa.
 *
 * Es un número que cambia con el calendario —festivos, cierres— y contra él
 * se mide el absentismo, así que lo fija quien administra y se guarda al salir
 * del campo. Vacío vuelve a la cuenta de lunes a sábado.
 */
export function DiasHabiles({
  companyId,
  mes,
  valor,
  porDefecto,
  editable,
}: {
  companyId: string
  mes: string
  /** Lo configurado, o null si la empresa no fijó nada. */
  valor: number | null
  porDefecto: number
  editable: boolean
}) {
  const [texto, setTexto] = useState(valor === null ? "" : String(valor))
  const [pendiente, startTransition] = useTransition()

  function guardar() {
    const n = Number(texto)
    if (texto !== "" && (!Number.isInteger(n) || n < 1 || n > 31)) {
      toast.error("Los días hábiles van de 1 a 31.")
      return
    }
    if ((texto === "" && valor === null) || n === valor) return
    startTransition(async () => {
      const r = await setBusinessDays(companyId, mes, texto === "" ? 0 : n)
      if (r.ok) toast.success(`Días hábiles de ${monthLabel(mes)}: ${texto || porDefecto}`)
      else toast.error(r.error ?? "No se pudo guardar.")
    })
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={`habiles-${mes}`} className="text-xs text-muted-foreground">
        Días hábiles · {monthLabel(mes)}
      </Label>
      <Input
        id={`habiles-${mes}`}
        type="number"
        min={1}
        max={31}
        inputMode="numeric"
        value={texto}
        placeholder={String(porDefecto)}
        disabled={!editable || pendiente}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={guardar}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="w-28 text-right tabular-nums"
      />
    </div>
  )
}
