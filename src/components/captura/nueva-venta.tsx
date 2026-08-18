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
import { Textarea } from "@/components/ui/textarea"
import { saveSale } from "@/lib/data/records-actions"
import { formatCOP, todayISO } from "@/lib/format"

export interface Catalogo {
  code: string
  name: string
}

/**
 * Alta de una venta.
 *
 * El saldo no se digita: es el valor final menos lo recaudado. Dejarlo a mano
 * es garantizar que un día no cuadre con los pagos, que es de donde sale la
 * cartera.
 */
export function NuevaVenta({
  companyId,
  branches,
  staff,
  financiaciones,
  productos,
  escuelas,
  estados,
  canManage,
  myStaffId,
}: {
  companyId: string
  branches: { id: string; name: string; is_primary: boolean }[]
  staff: { id: string; full_name: string }[]
  financiaciones: Catalogo[]
  productos: Catalogo[]
  escuelas: Catalogo[]
  estados: Catalogo[]
  /** Quien administra registra a nombre de cualquiera; el comercial, lo suyo. */
  canManage: boolean
  myStaffId: string | null
}) {
  const hoy = todayISO()
  const [open, setOpen] = useState(false)
  const [fecha, setFecha] = useState(hoy)
  const [staffId, setStaffId] = useState(myStaffId ?? "")
  const [branchId, setBranchId] = useState(
    branches.find((b) => b.is_primary)?.id ?? branches[0]?.id ?? "",
  )
  const [nombre, setNombre] = useState("")
  const [documento, setDocumento] = useState("")
  const [celular, setCelular] = useState("")
  const [financiacion, setFinanciacion] = useState("")
  const [producto, setProducto] = useState("")
  const [escuela, setEscuela] = useState("")
  const [estado, setEstado] = useState("")
  const [valor, setValor] = useState(0)
  const [descuento, setDescuento] = useState(0)
  const [recaudo, setRecaudo] = useState(0)
  const [cantidad, setCantidad] = useState(1)
  const [observacion, setObservacion] = useState("")
  const [pendiente, startTransition] = useTransition()

  const valorFinal = Math.max(0, valor - descuento)
  const saldo = Math.max(0, valorFinal - recaudo)
  const persona = staff.find((s) => s.id === staffId)
  const valido = !!branchId && nombre.trim().length > 2 && valorFinal > 0 && fecha <= hoy

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Nueva venta
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Nueva venta</DialogTitle>
          <DialogDescription>
            El crédito de un cliente: qué compró, cómo lo financió y cuánto abonó.
          </DialogDescription>
        </DialogHeader>

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
          <CampoTexto id="nombre" label="Cliente" value={nombre} onChange={setNombre} placeholder="Nombre completo" />
          <CampoTexto id="documento" label="Documento" value={documento} onChange={setDocumento} />
          <CampoTexto id="celular" label="Celular" value={celular} onChange={setCelular} />
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <CampoSelect id="financiacion" label="Financiación" value={financiacion} onChange={setFinanciacion} vacio="Sin definir"
            options={financiaciones.map((f) => ({ value: f.code, label: f.name }))} />
          <CampoSelect id="producto" label="Producto" value={producto} onChange={setProducto} vacio="Sin definir"
            options={productos.map((p) => ({ value: p.code, label: p.name }))} />
          <CampoSelect id="escuela" label="Escuela" value={escuela} onChange={setEscuela} vacio="Sin definir"
            options={escuelas.map((e) => ({ value: e.code, label: e.name }))} />
          <CampoSelect id="estado" label="Estado del trámite" value={estado} onChange={setEstado} vacio="Sin definir"
            options={estados.map((e) => ({ value: e.code, label: e.name }))} />
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <div className="min-w-0 space-y-2">
            <Label htmlFor="valor">Valor</Label>
            <MoneyInput id="valor" value={valor} onValueChange={setValor} />
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="descuento">Descuento</Label>
            <MoneyInput id="descuento" value={descuento} onValueChange={setDescuento} />
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="recaudo">Abonado hoy</Label>
            <MoneyInput id="recaudo" value={recaudo} onValueChange={setRecaudo} />
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="cantidad">Licencias</Label>
            <Input
              id="cantidad"
              type="number"
              min={0}
              inputMode="numeric"
              value={cantidad}
              onChange={(e) => setCantidad(Math.max(0, Number(e.target.value) || 0))}
              className="text-right tabular-nums"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-6 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
          <span>
            Valor final: <strong className="tabular-nums">{formatCOP(valorFinal)}</strong>
          </span>
          <span>
            Saldo:{" "}
            <strong className={saldo > 0 ? "tabular-nums text-amber-600" : "tabular-nums"}>
              {formatCOP(saldo)}
            </strong>
          </span>
          <span className="text-xs text-muted-foreground">
            El saldo se calcula: valor final menos lo abonado.
          </span>
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
                const r = await saveSale({
                  company_id: companyId,
                  branch_id: branchId,
                  report_date: fecha,
                  staff_id: valorOpcional(staffId),
                  responsable_nombre: persona?.full_name ?? null,
                  ref_credito: documento.trim() ? `${documento.trim()} - ${fecha}` : null,
                  financing_code: valorOpcional(financiacion),
                  product_code: valorOpcional(producto),
                  school_code: valorOpcional(escuela),
                  state_code: valorOpcional(estado),
                  licencia_nombre: nombre.trim(),
                  licencia_id: documento.trim() || null,
                  licencia_celular: celular.trim() || null,
                  credito_nombre: nombre.trim(),
                  credito_id: documento.trim() || null,
                  valor_inicial: valor,
                  adicion: 0,
                  descuento,
                  valor_final: valorFinal,
                  recaudo,
                  saldo,
                  cantidad_final: cantidad,
                  observacion: observacion.trim() || null,
                })
                if (!r.ok) {
                  toast.error(r.error ?? "No se pudo guardar la venta.")
                  return
                }
                toast.success("Venta registrada", {
                  description: `${nombre} · ${formatCOP(valorFinal)}`,
                })
                setOpen(false)
              })
            }
          >
            <Save className="size-4" />
            {pendiente ? "Guardando…" : "Guardar venta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
