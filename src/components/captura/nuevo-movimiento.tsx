"use client"

import { Plus, Save } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { CampoSelect, CampoTexto, valorOpcional } from "@/components/captura/campos"
import { MoneyInput } from "@/components/money-input"
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { saveCashMovement } from "@/lib/data/records-actions"
import { todayISO } from "@/lib/format"

/**
 * Movimiento de caja.
 *
 * El monto se digita siempre en positivo y el tipo decide el signo al guardar:
 * pedirle a alguien que escriba "-717000" es pedirle que se equivoque.
 */
export function NuevoMovimiento({
  companyId,
  branches,
  staff,
  conceptos,
  mediosPago,
}: {
  companyId: string
  branches: { id: string; name: string; is_primary: boolean }[]
  staff: { id: string; full_name: string }[]
  conceptos: { code: string; name: string }[]
  mediosPago: { code: string; name: string }[]
}) {
  const hoy = todayISO()
  const [open, setOpen] = useState(false)
  const [tipo, setTipo] = useState<"entrada" | "salida">("salida")
  const [fecha, setFecha] = useState(hoy)
  const [branchId, setBranchId] = useState(
    branches.find((b) => b.is_primary)?.id ?? branches[0]?.id ?? "",
  )
  const [concepto, setConcepto] = useState("")
  const [medio, setMedio] = useState("")
  const [staffId, setStaffId] = useState("")
  const [nombre, setNombre] = useState("")
  const [factura, setFactura] = useState("")
  const [monto, setMonto] = useState(0)
  const [observacion, setObservacion] = useState("")
  const [pendiente, startTransition] = useTransition()

  const persona = staff.find((s) => s.id === staffId)
  const valido = !!branchId && monto > 0 && fecha <= hoy

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Nuevo movimiento
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuevo movimiento de caja</DialogTitle>
          <DialogDescription>Una entrada o una salida de dinero del punto.</DialogDescription>
        </DialogHeader>

        <Tabs value={tipo} onValueChange={(v) => setTipo(v as "entrada" | "salida")}>
          <TabsList>
            <TabsTrigger value="salida">Salida</TabsTrigger>
            <TabsTrigger value="entrada">Entrada</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="min-w-0 space-y-2">
            <Label htmlFor="fecha">Fecha</Label>
            <Input
              id="fecha"
              type="date"
              value={fecha}
              max={hoy}
              onChange={(e) => e.target.value && setFecha(e.target.value)}
            />
          </div>
          <CampoSelect
            id="sede"
            label="Sede"
            value={branchId}
            onChange={setBranchId}
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
          />
          <div className="min-w-0 space-y-2">
            <Label htmlFor="monto">Valor</Label>
            <MoneyInput id="monto" value={monto} onValueChange={setMonto} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <CampoSelect
            id="concepto"
            label="Concepto"
            value={concepto}
            onChange={setConcepto}
            vacio="Sin definir"
            options={conceptos.map((c) => ({ value: c.code, label: c.name }))}
          />
          <CampoSelect
            id="medio"
            label="Medio de pago"
            value={medio}
            onChange={setMedio}
            vacio="Sin definir"
            options={mediosPago.map((m) => ({ value: m.code, label: m.name }))}
          />
          <CampoSelect
            id="responsable"
            label="Responsable"
            value={staffId}
            onChange={setStaffId}
            vacio="Sin responsable"
            options={staff.map((s) => ({ value: s.id, label: s.full_name }))}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto id="nombre" label="A nombre de" value={nombre} onChange={setNombre} placeholder="Quién recibe o entrega" />
          <CampoTexto id="factura" label="Factura o soporte" value={factura} onChange={setFactura} />
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
                const r = await saveCashMovement({
                  company_id: companyId,
                  branch_id: branchId,
                  report_date: fecha,
                  kind: tipo,
                  concept_code: valorOpcional(concepto),
                  method_code: valorOpcional(medio),
                  staff_id: valorOpcional(staffId),
                  responsable_nombre: persona?.full_name ?? null,
                  nombre: nombre.trim() || null,
                  factura: factura.trim() || null,
                  amount: monto,
                  observacion: observacion.trim() || null,
                })
                if (!r.ok) {
                  toast.error(r.error ?? "No se pudo guardar el movimiento.")
                  return
                }
                toast.success(tipo === "entrada" ? "Entrada registrada" : "Salida registrada")
                setMonto(0)
                setNombre("")
                setFactura("")
                setObservacion("")
                setOpen(false)
              })
            }
          >
            <Save className="size-4" />
            {pendiente ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
