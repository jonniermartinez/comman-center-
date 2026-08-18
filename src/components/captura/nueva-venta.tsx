"use client"

import { Pencil, Plus, Save } from "lucide-react"
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

/** Una venta ya registrada, como la devuelve el listado. */
export interface VentaExistente {
  id: string
  branch_id: string
  report_date: string
  staff_id: string | null
  ref_credito: string | null
  financing_code: string | null
  product_code: string | null
  school_code: string | null
  state_code: string | null
  licencia_nombre: string | null
  licencia_id: string | null
  licencia_celular: string | null
  valor_inicial: number
  descuento: number
  valor_final: number
  recaudo: number
  cantidad_final: number
  observacion: string | null
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
  registro,
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
  /** Si viene, el formulario corrige esa venta en vez de crear una. */
  registro?: VentaExistente
}) {
  const hoy = todayISO()
  const editando = !!registro
  const [open, setOpen] = useState(false)
  const [fecha, setFecha] = useState(registro?.report_date ?? hoy)
  const [staffId, setStaffId] = useState(registro?.staff_id ?? myStaffId ?? "")
  const [branchId, setBranchId] = useState(
    registro?.branch_id ?? branches.find((b) => b.is_primary)?.id ?? branches[0]?.id ?? "",
  )
  const [nombre, setNombre] = useState(registro?.licencia_nombre ?? "")
  const [documento, setDocumento] = useState(registro?.licencia_id ?? "")
  const [celular, setCelular] = useState(registro?.licencia_celular ?? "")
  const [financiacion, setFinanciacion] = useState(registro?.financing_code ?? "")
  const [producto, setProducto] = useState(registro?.product_code ?? "")
  const [escuela, setEscuela] = useState(registro?.school_code ?? "")
  const [estado, setEstado] = useState(registro?.state_code ?? "")
  const [valor, setValor] = useState(Number(registro?.valor_inicial ?? 0))
  const [descuento, setDescuento] = useState(Number(registro?.descuento ?? 0))
  const [recaudo, setRecaudo] = useState(Number(registro?.recaudo ?? 0))
  const [cantidad, setCantidad] = useState(Number(registro?.cantidad_final ?? 1))
  const [observacion, setObservacion] = useState(registro?.observacion ?? "")
  const [pendiente, startTransition] = useTransition()

  const valorFinal = Math.max(0, valor - descuento)
  const saldo = Math.max(0, valorFinal - recaudo)
  const persona = staff.find((s) => s.id === staffId)
  const valido = !!branchId && nombre.trim().length > 2 && valorFinal > 0 && fecha <= hoy

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editando ? (
          <Button variant="ghost" size="icon" className="size-8">
            <Pencil className="size-4" />
            <span className="sr-only">Editar la venta de {registro.licencia_nombre}</span>
          </Button>
        ) : (
          <Button>
            <Plus className="size-4" />
            Nueva venta
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar venta" : "Nueva venta"}</DialogTitle>
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
                  id: registro?.id,
                  company_id: companyId,
                  branch_id: branchId,
                  report_date: fecha,
                  staff_id: valorOpcional(staffId),
                  responsable_nombre: persona?.full_name ?? null,
                  ref_credito:
                    registro?.ref_credito ??
                    (documento.trim() ? `${documento.trim()} - ${fecha}` : null),
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
                toast.success(editando ? "Venta actualizada" : "Venta registrada", {
                  description: `${nombre} · ${formatCOP(valorFinal)}`,
                })
                setOpen(false)
              })
            }
          >
            <Save className="size-4" />
            {pendiente ? "Guardando…" : editando ? "Guardar cambios" : "Guardar venta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
