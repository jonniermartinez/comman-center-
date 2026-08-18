"use client"

import { Plus, Save, Search } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { CampoSelect, valorOpcional } from "@/components/captura/campos"
import { MoneyInput } from "@/components/money-input"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
import { buscarVentas, type VentaBuscada } from "@/lib/data/records-actions"
import { formatCOP, formatDate, todayISO } from "@/lib/format"

/**
 * Registro de un abono.
 *
 * Primero se busca la venta y después se digita el monto: un pago suelto, sin
 * el crédito al que pertenece, no sirve para saber cuánto debe el cliente, que
 * es justamente para lo que se lleva esta hoja.
 */
export function NuevoPago({
  companyId,
  branches,
  mediosPago,
}: {
  companyId: string
  branches: { id: string; name: string; is_primary: boolean }[]
  mediosPago: { code: string; name: string }[]
}) {
  const hoy = todayISO()
  const [open, setOpen] = useState(false)
  const [busqueda, setBusqueda] = useState("")
  const [resultados, setResultados] = useState<VentaBuscada[]>([])
  const [venta, setVenta] = useState<VentaBuscada | null>(null)
  const [fecha, setFecha] = useState(hoy)
  const [monto, setMonto] = useState(0)
  const [medio, setMedio] = useState("")
  const [recibo, setRecibo] = useState("")
  const [buscando, startBusqueda] = useTransition()
  const [pendiente, startTransition] = useTransition()

  const valido = !!venta && monto > 0 && fecha <= hoy

  function limpiar() {
    setBusqueda("")
    setResultados([])
    setVenta(null)
    setMonto(0)
    setRecibo("")
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) limpiar()
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Registrar pago
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>Un abono contra el crédito de un cliente.</DialogDescription>
        </DialogHeader>

        {venta ? (
          <div className="space-y-4">
            <div className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{venta.cliente}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {venta.documento} · {formatDate(venta.report_date)}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setVenta(null)}>
                  Cambiar
                </Button>
              </div>
              <div className="mt-2 flex gap-6 border-t pt-2 text-sm">
                <span>
                  Valor: <strong className="tabular-nums">{formatCOP(venta.valor_final)}</strong>
                </span>
                <span>
                  Saldo:{" "}
                  <strong
                    className={venta.saldo > 0 ? "tabular-nums text-amber-600" : "tabular-nums"}
                  >
                    {formatCOP(venta.saldo)}
                  </strong>
                </span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <Label htmlFor="fecha">Fecha del pago</Label>
                <Input
                  id="fecha"
                  type="date"
                  value={fecha}
                  max={hoy}
                  onChange={(e) => e.target.value && setFecha(e.target.value)}
                />
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="monto">Valor</Label>
                <MoneyInput id="monto" value={monto} onValueChange={setMonto} />
              </div>
              <CampoSelect
                id="medio"
                label="Medio de pago"
                value={medio}
                onChange={setMedio}
                vacio="Sin definir"
                options={mediosPago.map((m) => ({ value: m.code, label: m.name }))}
              />
              <div className="min-w-0 space-y-2">
                <Label htmlFor="recibo">Recibo o voucher</Label>
                <Input id="recibo" value={recibo} onChange={(e) => setRecibo(e.target.value)} />
              </div>
            </div>

            {monto > venta.saldo && venta.saldo > 0 && (
              <Alert>
                <AlertDescription>
                  El abono supera el saldo de {formatCOP(venta.saldo)}. Se guarda igual —puede ser
                  un pago adelantado o una corrección— pero verifica que sea lo que quieres.
                </AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault()
                startBusqueda(async () => {
                  setResultados(await buscarVentas(companyId, busqueda))
                })
              }}
            >
              <Label htmlFor="buscar">Buscar la venta</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="buscar"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Nombre o documento del cliente"
                    className="pl-8"
                    autoFocus
                  />
                </div>
                <Button type="submit" variant="outline" disabled={buscando}>
                  {buscando ? "Buscando…" : "Buscar"}
                </Button>
              </div>
            </form>

            {resultados.length > 0 && (
              <div className="divide-y overflow-hidden rounded-lg border">
                {resultados.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVenta(v)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-accent"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{v.cliente}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {v.documento} · {formatDate(v.report_date)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-sm tabular-nums">
                      <span className="block">{formatCOP(v.valor_final)}</span>
                      <span
                        className={
                          v.saldo > 0 ? "block text-xs text-amber-600" : "block text-xs text-muted-foreground"
                        }
                      >
                        saldo {formatCOP(v.saldo)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            {resultados.length === 0 && busqueda && !buscando && (
              <p className="text-sm text-muted-foreground">
                Ninguna venta coincide. Prueba con el documento del cliente.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!valido || pendiente}
            onClick={() =>
              startTransition(async () => {
                if (!venta) return
                const { savePayment } = await import("@/lib/data/records-actions")
                const r = await savePayment({
                  company_id: companyId,
                  branch_id: venta.branch_id,
                  sale_id: venta.id,
                  ref_credito: venta.ref_credito,
                  report_date: fecha,
                  titular_id: venta.documento,
                  titular_nombre: venta.cliente,
                  amount: monto,
                  method_code: valorOpcional(medio),
                  recibo: recibo.trim() || null,
                })
                if (!r.ok) {
                  toast.error(r.error ?? "No se pudo guardar el pago.")
                  return
                }
                toast.success("Pago registrado", {
                  description: `${venta.cliente} · ${formatCOP(monto)}`,
                })
                limpiar()
                setOpen(false)
              })
            }
          >
            <Save className="size-4" />
            {pendiente ? "Guardando…" : "Guardar pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
