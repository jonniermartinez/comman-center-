"use client"

import { Check, MessageSquare } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { SectionCard, SectionCardHeader } from "@/components/section-card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { registrarCrm } from "@/lib/data/jornada-actions"
import type { MiJornada } from "@/lib/data/mi-jornada"
import { MOMENTOS, type Momento } from "@/lib/mi-jornada"

type Cola = NonNullable<MiJornada["crm"]>

/** Lo que hay registrado en un momento concreto, o null si no se ha tomado. */
function foto(crm: Cola | null, momento: Momento) {
  if (!crm) return null
  const sufijo = momento === "medio_dia" ? "medio" : momento
  const chats = crm[`chats_${sufijo}` as keyof Cola]
  const tareas = crm[`tareas_${sufijo}` as keyof Cola]
  const caducadas = crm[`caducadas_${sufijo}` as keyof Cola]
  if (!chats && !tareas && !caducadas) return null
  return { chats, tareas, caducadas }
}

/**
 * La cola del CRM, tres veces al día.
 *
 * Lo que mide el Excel no es cuántos chats hay, sino cuántos se depuraron
 * entre la mañana y la tarde. Por eso son tres fotos y no un número: la
 * diferencia es el dato, y sin las dos puntas no existe.
 */
export function DialogCrm({ jornadaId, crm }: { jornadaId: string; crm: Cola | null }) {
  const [abierto, setAbierto] = useState<Momento | null>(null)
  const [chats, setChats] = useState(0)
  const [tareas, setTareas] = useState(0)
  const [caducadas, setCaducadas] = useState(0)
  const [pendiente, startTransition] = useTransition()

  function abrir(momento: Momento) {
    const actual = foto(crm, momento)
    setChats(Number(actual?.chats ?? 0))
    setTareas(Number(actual?.tareas ?? 0))
    setCaducadas(Number(actual?.caducadas ?? 0))
    setAbierto(momento)
  }

  const depurados =
    crm && crm.chats_inicial && crm.chats_final ? crm.chats_inicial - crm.chats_final : null

  return (
    <SectionCard>
      <SectionCardHeader
        icon={MessageSquare}
        title="Cola del CRM"
        description="Tómala al empezar, a media mañana y al cerrar. La diferencia es lo que depuraste."
        actions={
          depurados !== null ? (
            <span className="text-xs text-muted-foreground">
              Depurados hoy: <span className="font-medium text-foreground">{depurados}</span>
            </span>
          ) : undefined
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {MOMENTOS.map((m) => {
          const actual = foto(crm, m.code)
          return (
            <button
              key={m.code}
              type="button"
              onClick={() => abrir(m.code)}
              className="rounded-xl border bg-card px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <p className="flex items-center gap-1.5 text-xs tracking-wide text-muted-foreground uppercase">
                {m.label}
                {actual && <Check className="size-3 text-emerald-600" />}
              </p>
              {actual ? (
                <p className="mt-1.5 text-sm tabular-nums">
                  {actual.chats} chats · {actual.tareas} tareas
                  <span className="block text-xs text-muted-foreground">
                    {actual.caducadas} caducadas
                  </span>
                </p>
              ) : (
                <p className="mt-1.5 text-sm text-muted-foreground">Sin tomar</p>
              )}
            </button>
          )
        })}
      </div>

      <Dialog open={abierto !== null} onOpenChange={(v) => !pendiente && setAbierto(v ? abierto : null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Cola del CRM · {MOMENTOS.find((m) => m.code === abierto)?.label}
            </DialogTitle>
            <DialogDescription>Como está el CRM en este momento.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {(
              [
                ["crm-chats", "Chats por responder", chats, setChats],
                ["crm-tareas", "Tareas del día", tareas, setTareas],
                ["crm-caducadas", "Tareas caducadas", caducadas, setCaducadas],
              ] as const
            ).map(([id, label, valor, set]) => (
              <div key={id} className="grid grid-cols-[1fr_6rem] items-center gap-3">
                <Label htmlFor={id} className="font-normal">
                  {label}
                </Label>
                <Input
                  id={id}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={valor}
                  onChange={(e) => set(Math.max(0, Number(e.target.value) || 0))}
                  className="text-right tabular-nums"
                />
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" disabled={pendiente} onClick={() => setAbierto(null)}>
              Cancelar
            </Button>
            <Button
              disabled={pendiente}
              onClick={() =>
                startTransition(async () => {
                  if (!abierto) return
                  const r = await registrarCrm({
                    jornadaId,
                    momento: abierto,
                    chats,
                    tareas,
                    caducadas,
                  })
                  if (!r.ok) {
                    toast.error(r.error ?? "No se pudo guardar.")
                    return
                  }
                  toast.success("Cola del CRM registrada")
                  setAbierto(null)
                })
              }
            >
              {pendiente ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  )
}
