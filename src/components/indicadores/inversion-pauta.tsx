"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { setAdSpend } from "@/lib/data/companies-actions"
import { formatCOP } from "@/lib/format"
import { monthLabel } from "@/lib/kpi"

/**
 * Cuánto se invirtió en pauta este mes, en pesos.
 *
 * Lo anota quien administra, cada dos días más o menos, con el acumulado del
 * mes. Es el único dato del ROAS que no sale de la base. Se guarda al salir
 * del campo, como los días hábiles; vacío lo borra y el ROAS queda en "—".
 */
export function InversionPauta({
  companyId,
  mes,
  valor,
  editable,
}: {
  companyId: string
  mes: string
  /** Lo digitado, o null si nadie anotó nada para el mes. */
  valor: number | null
  editable: boolean
}) {
  const [texto, setTexto] = useState(valor === null ? "" : String(valor))
  const [pendiente, startTransition] = useTransition()

  function guardar() {
    const limpio = texto.replace(/[^\d]/g, "")
    const n = limpio === "" ? 0 : Number(limpio)
    if (texto.trim() !== "" && (limpio === "" || !Number.isFinite(n))) {
      toast.error("La inversión va en pesos, sin decimales.")
      setTexto(valor === null ? "" : String(valor))
      return
    }
    if ((limpio === "" && valor === null) || n === valor) {
      setTexto(limpio)
      return
    }
    startTransition(async () => {
      const r = await setAdSpend(companyId, mes, n)
      if (r.ok) {
        toast.success(
          n === 0
            ? `Inversión en pauta de ${monthLabel(mes)}: sin dato.`
            : `Inversión en pauta de ${monthLabel(mes)}: ${formatCOP(n)}.`,
        )
        setTexto(limpio)
      } else {
        toast.error(r.error ?? "No se pudo guardar.")
        setTexto(valor === null ? "" : String(valor))
      }
    })
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={`pauta-${mes}`} className="text-xs text-muted-foreground">
        Inversión en pauta · {monthLabel(mes)}
      </Label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground">
          $
        </span>
        <Input
          id={`pauta-${mes}`}
          type="text"
          inputMode="numeric"
          value={texto}
          placeholder="0"
          disabled={!editable || pendiente}
          title={editable ? "Acumulado del mes, en pesos. Vacío lo borra." : undefined}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={guardar}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="w-40 pl-6 text-right tabular-nums"
        />
      </div>
    </div>
  )
}
