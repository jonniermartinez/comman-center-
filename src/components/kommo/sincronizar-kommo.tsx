"use client"

import { RefreshCw } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { sincronizarKommo } from "@/lib/data/kommo-actions"
import { todayISO } from "@/lib/format"

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/**
 * Trae las agendas de Kommo de un rango de fechas.
 *
 * El rango por defecto mira un mes atrás y, salvo en el modo por etapa —que
 * lee cosas que ya pasaron—, un mes adelante: una agenda es un compromiso a
 * futuro.
 */
export function SincronizarKommo({
  companyId,
  haciaAdelante = true,
  variant = "outline",
}: {
  companyId: string
  haciaAdelante?: boolean
  variant?: "outline" | "default"
}) {
  const hoy = todayISO()
  const [open, setOpen] = useState(false)
  const [desde, setDesde] = useState(sumarDias(hoy, -30))
  const [hasta, setHasta] = useState(haciaAdelante ? sumarDias(hoy, 30) : hoy)
  const [pendiente, startTransition] = useTransition()

  return (
    <Dialog open={open} onOpenChange={(v) => !pendiente && setOpen(v)}>
      <DialogTrigger asChild>
        <Button variant={variant}>
          <RefreshCw className="size-4" />
          Traer de Kommo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Traer agendas de Kommo</DialogTitle>
          <DialogDescription>
            Las del rango que falten. Lo que ya está se actualiza, no se duplica.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="min-w-0 space-y-2">
            <Label htmlFor="kommo-desde">Desde</Label>
            <Input
              id="kommo-desde"
              type="date"
              value={desde}
              onChange={(e) => e.target.value && setDesde(e.target.value)}
            />
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="kommo-hasta">Hasta</Label>
            <Input
              id="kommo-hasta"
              type="date"
              value={hasta}
              onChange={(e) => e.target.value && setHasta(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={pendiente} onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            disabled={pendiente || desde > hasta}
            onClick={() =>
              startTransition(async () => {
                const r = await sincronizarKommo({ company_id: companyId, desde, hasta })
                if (!r.ok) {
                  toast.error(r.error ?? "No se pudo sincronizar.")
                  return
                }
                toast.success("Listo", {
                  description:
                    r.guardadas === 0
                      ? "No hubo agendas en ese rango."
                      : `${r.guardadas} ${r.guardadas === 1 ? "agenda" : "agendas"} al día.`,
                })
                setOpen(false)
              })
            }
          >
            <RefreshCw className={pendiente ? "size-4 animate-spin" : "size-4"} />
            {pendiente ? "Trayendo…" : "Traer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
