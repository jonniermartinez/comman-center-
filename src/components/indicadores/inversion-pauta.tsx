"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { setAdSpend } from "@/lib/data/companies-actions"
import { formatCOP } from "@/lib/format"
import { monthLabel } from "@/lib/kpi"

const CAMPOS = {
  presupuesto: {
    etiqueta: "Presupuesto autorizado",
    ayuda: "Lo autorizado para todo el mes, en pesos. Vacío lo borra.",
  },
  monto: {
    etiqueta: "Invertido en pauta",
    ayuda: "Lo que va invertido en el mes (acumulado), en pesos. Vacío lo borra.",
  },
} as const

/**
 * Los dos datos de pauta del mes que se digitan, en pesos: el presupuesto
 * autorizado y lo que va realmente invertido.
 *
 * Los anota quien administra: el presupuesto una vez, lo invertido cada dos
 * días más o menos con el acumulado del mes. Son los únicos datos del ROAS que
 * no salen de la base. Se guardan al salir del campo, como los días hábiles;
 * vacío borra el dato y lo que dependa de él queda en "—".
 */
export function InversionPauta({
  companyId,
  mes,
  campo,
  valor,
  editable,
}: {
  companyId: string
  mes: string
  campo: keyof typeof CAMPOS
  /** Lo digitado, o null si nadie anotó nada para el mes. */
  valor: number | null
  editable: boolean
}) {
  const [texto, setTexto] = useState(valor === null ? "" : String(valor))
  const [pendiente, startTransition] = useTransition()
  const { etiqueta, ayuda } = CAMPOS[campo]
  const id = `pauta-${campo}-${mes}`

  function guardar() {
    const limpio = texto.replace(/[^\d]/g, "")
    const n = limpio === "" ? 0 : Number(limpio)
    if (texto.trim() !== "" && (limpio === "" || !Number.isFinite(n))) {
      toast.error("El valor va en pesos, sin decimales.")
      setTexto(valor === null ? "" : String(valor))
      return
    }
    if ((limpio === "" && valor === null) || n === valor) {
      setTexto(limpio)
      return
    }
    startTransition(async () => {
      const r = await setAdSpend(companyId, mes, campo, n)
      if (r.ok) {
        toast.success(
          n === 0
            ? `${etiqueta} de ${monthLabel(mes)}: sin dato.`
            : `${etiqueta} de ${monthLabel(mes)}: ${formatCOP(n)}.`,
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
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {etiqueta} · {monthLabel(mes)}
      </Label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground">
          $
        </span>
        <Input
          id={id}
          type="text"
          inputMode="numeric"
          value={texto}
          placeholder="0"
          disabled={!editable || pendiente}
          title={editable ? ayuda : undefined}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={guardar}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="w-40 pl-6 text-right tabular-nums"
        />
      </div>
    </div>
  )
}
