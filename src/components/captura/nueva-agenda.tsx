"use client"

import { Pencil, Plus, Save } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { CampoSelect, CampoTexto, valorOpcional } from "@/components/captura/campos"
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
import { Textarea } from "@/components/ui/textarea"
import { saveAppointment } from "@/lib/data/records-actions"
import { todayISO } from "@/lib/format"

const RESULTADOS = ["Venta", "Seguimiento 1", "Seguimiento 2", "Seguimiento 3"]

/**
 * Cita con un cliente.
 *
 * A diferencia del resto de la captura, acá sí se pueden poner fechas futuras:
 * una agenda es precisamente un compromiso para más adelante.
 */
/** Una agenda ya registrada, como la devuelve el listado. */
export interface AgendaExistente {
  id: string
  branch_id: string
  scheduled_at: string
  scheduled_time: string | null
  staff_id: string | null
  nombre: string | null
  celular: string | null
  resultado: string | null
  observacion: string | null
}

export function NuevaAgenda({
  companyId,
  branches,
  staff,
  canManage,
  myStaffId,
  registro,
}: {
  companyId: string
  branches: { id: string; name: string; is_primary: boolean }[]
  staff: { id: string; full_name: string }[]
  canManage: boolean
  myStaffId: string | null
  /** Si viene, el formulario corrige esa agenda. */
  registro?: AgendaExistente
}) {
  const editando = !!registro
  const [open, setOpen] = useState(false)
  const [fecha, setFecha] = useState(registro?.scheduled_at ?? todayISO())
  const [hora, setHora] = useState(registro?.scheduled_time?.slice(0, 5) ?? "")
  const [branchId, setBranchId] = useState(
    registro?.branch_id ?? branches.find((b) => b.is_primary)?.id ?? branches[0]?.id ?? "",
  )
  const [staffId, setStaffId] = useState(registro?.staff_id ?? myStaffId ?? "")
  const [nombre, setNombre] = useState(registro?.nombre ?? "")
  const [celular, setCelular] = useState(registro?.celular ?? "")
  const [resultado, setResultado] = useState(registro?.resultado ?? "")
  const [observacion, setObservacion] = useState(registro?.observacion ?? "")
  const [pendiente, startTransition] = useTransition()

  const persona = staff.find((s) => s.id === staffId)
  const valido = !!branchId && nombre.trim().length > 2

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editando ? (
          <Button variant="ghost" size="icon" className="size-8">
            <Pencil className="size-4" />
            <span className="sr-only">Editar la agenda de {registro.nombre}</span>
          </Button>
        ) : (
          <Button>
            <Plus className="size-4" />
            Nueva agenda
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar agenda" : "Nueva agenda"}</DialogTitle>
          <DialogDescription>Una cita concertada con un cliente.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-4">
          <div className="min-w-0 space-y-2">
            <Label htmlFor="fecha">Fecha</Label>
            <Input
              id="fecha"
              type="date"
              value={fecha}
              onChange={(e) => e.target.value && setFecha(e.target.value)}
            />
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="hora">Hora</Label>
            <Input id="hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </div>
          <CampoSelect
            id="sede"
            label="Sede"
            value={branchId}
            onChange={setBranchId}
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
          />
          {canManage ? (
            <CampoSelect
              id="responsable"
              label="Responsable"
              value={staffId}
              onChange={setStaffId}
              vacio="Sin responsable"
              options={staff.map((s) => ({ value: s.id, label: s.full_name }))}
            />
          ) : (
            <div className="min-w-0 space-y-2">
              <Label>Responsable</Label>
              <p className="flex h-8 items-center text-sm">{persona?.full_name ?? "—"}</p>
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <CampoTexto id="nombre" label="Cliente" value={nombre} onChange={setNombre} />
          <CampoTexto id="celular" label="Celular" value={celular} onChange={setCelular} />
          <CampoSelect
            id="resultado"
            label="Resultado"
            value={resultado}
            onChange={setResultado}
            vacio="Sin resultado todavía"
            options={RESULTADOS.map((r) => ({ value: r, label: r }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="obs">Observación (opcional)</Label>
          <Textarea id="obs" rows={2} value={observacion} onChange={(e) => setObservacion(e.target.value)} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!valido || pendiente}
            onClick={() =>
              startTransition(async () => {
                const r = await saveAppointment({
                  id: registro?.id,
                  company_id: companyId,
                  branch_id: branchId,
                  scheduled_at: fecha,
                  scheduled_time: hora || null,
                  nombre: nombre.trim(),
                  celular: celular.trim() || null,
                  staff_id: valorOpcional(staffId),
                  responsable_nombre: persona?.full_name ?? null,
                  resultado: valorOpcional(resultado),
                  observacion: observacion.trim() || null,
                })
                if (!r.ok) {
                  toast.error(r.error ?? "No se pudo guardar la agenda.")
                  return
                }
                toast.success(editando ? "Agenda actualizada" : "Agenda registrada", {
                  description: nombre,
                })
                if (!editando) {
                  setNombre("")
                  setCelular("")
                  setObservacion("")
                }
                setOpen(false)
              })
            }
          >
            <Save className="size-4" />
            {pendiente ? "Guardando…" : editando ? "Guardar cambios" : "Guardar agenda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
