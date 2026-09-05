"use client"

import { ExternalLink, Paperclip, Pencil, Plus, Save, Search, X } from "lucide-react"
import { useRef, useState, useTransition } from "react"
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
import { esVentaDeContado } from "@/lib/ventas"

/**
 * Registro de un abono.
 *
 * Primero se busca la venta y después se digita el monto: un pago suelto, sin
 * el crédito al que pertenece, no sirve para saber cuánto debe el cliente, que
 * es justamente para lo que se lleva esta hoja.
 */
/** Un pago ya registrado, como lo devuelve el listado. */
export interface PagoExistente {
  id: string
  branch_id: string
  sale_id: string | null
  ref_credito: string | null
  report_date: string
  titular_id: string | null
  titular_nombre: string | null
  amount: number
  method_code: string | null
  recibo: string | null
  /** Ruta del comprobante en el bucket, si se adjuntó. */
  voucher: string | null
  /** Financiación de la venta a la que pertenece; decide si el comprobante es obligatorio. */
  financing_code?: string | null
}

export function NuevoPago({
  companyId,
  branches,
  mediosPago,
  registro,
  voucherUrl,
}: {
  companyId: string
  branches: { id: string; name: string; is_primary: boolean }[]
  mediosPago: { code: string; name: string }[]
  /** Si viene, el formulario corrige ese abono en vez de crear uno. */
  registro?: PagoExistente
  /** URL firmada del comprobante ya guardado, para verlo al editar. */
  voucherUrl?: string
}) {
  const hoy = todayISO()
  const editando = !!registro
  const [open, setOpen] = useState(false)
  const [busqueda, setBusqueda] = useState("")
  const [resultados, setResultados] = useState<VentaBuscada[]>([])
  // Al corregir no se vuelve a buscar la venta: el abono ya está colgado de la
  // suya y cambiarla sería otro pago, no una corrección.
  const [venta, setVenta] = useState<VentaBuscada | null>(
    registro
      ? {
          id: registro.sale_id ?? "",
          branch_id: registro.branch_id,
          ref_credito: registro.ref_credito,
          financing_code: registro.financing_code ?? null,
          cliente: registro.titular_nombre ?? "—",
          documento: registro.titular_id ?? "",
          report_date: registro.report_date,
          valor_final: 0,
          saldo: 0,
        }
      : null,
  )
  const [fecha, setFecha] = useState(registro?.report_date ?? hoy)
  const [monto, setMonto] = useState(Number(registro?.amount ?? 0))
  const [medio, setMedio] = useState(registro?.method_code ?? "")
  const [recibo, setRecibo] = useState(registro?.recibo ?? "")
  const [archivo, setArchivo] = useState<File | null>(null)
  const inputArchivo = useRef<HTMLInputElement>(null)
  const [buscando, startBusqueda] = useTransition()
  const [pendiente, startTransition] = useTransition()

  // Con crédito el comprobante es obligatorio: es lo que respalda el abono
  // frente al cliente y la financiera. De contado es opcional.
  const comprobanteObligatorio = !!venta && !esVentaDeContado(venta.financing_code)
  const tieneComprobante = !!archivo || !!registro?.voucher
  const valido =
    !!venta && monto > 0 && fecha <= hoy && (!comprobanteObligatorio || tieneComprobante)

  function limpiar() {
    setBusqueda("")
    setResultados([])
    setVenta(null)
    setMonto(0)
    setRecibo("")
    setArchivo(null)
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
        {editando ? (
          <Button variant="ghost" size="icon" className="size-8">
            <Pencil className="size-4" />
            <span className="sr-only">Editar el pago de {registro.titular_nombre}</span>
          </Button>
        ) : (
          <Button>
            <Plus className="size-4" />
            Registrar pago
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar pago" : "Registrar pago"}</DialogTitle>
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
                {!editando && (
                  <Button variant="ghost" size="sm" onClick={() => setVenta(null)}>
                    Cambiar
                  </Button>
                )}
              </div>
              <div className={editando ? "hidden" : "mt-2 flex gap-6 border-t pt-2 text-sm"}>
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
                <Label htmlFor="recibo">Número de recibo o voucher</Label>
                <Input id="recibo" value={recibo} onChange={(e) => setRecibo(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="comprobante">
                Comprobante (foto o PDF)
                <span className="font-normal text-muted-foreground">
                  {comprobanteObligatorio ? " · obligatorio en crédito" : " · opcional de contado"}
                </span>
              </Label>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  id="comprobante"
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => inputArchivo.current?.click()}
                >
                  <Paperclip className="size-4" />
                  {archivo || registro?.voucher ? "Cambiar archivo" : "Adjuntar archivo"}
                </Button>
                {archivo ? (
                  <span className="flex min-w-0 items-center gap-1 text-sm">
                    <span className="truncate">{archivo.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      onClick={() => setArchivo(null)}
                    >
                      <X className="size-3.5" />
                      <span className="sr-only">Quitar archivo</span>
                    </Button>
                  </span>
                ) : registro?.voucher ? (
                  voucherUrl ? (
                    <a
                      href={voucherUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-sm underline underline-offset-4"
                    >
                      Ver comprobante actual
                      <ExternalLink className="size-3.5" />
                    </a>
                  ) : (
                    <span className="text-sm text-muted-foreground">Ya tiene comprobante</span>
                  )
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {comprobanteObligatorio ? "Falta el comprobante." : "Sin archivo."}
                  </span>
                )}
              </div>
              <input
                ref={inputArchivo}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/heic,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) setArchivo(f)
                  e.target.value = ""
                }}
              />
              <p className="text-xs text-muted-foreground">
                Imagen o PDF, hasta 5 MB. Desde el celular puedes tomar la foto al momento.
              </p>
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
                const { savePayment, uploadPaymentReceipt } = await import(
                  "@/lib/data/records-actions"
                )

                let voucher = registro?.voucher ?? null
                if (archivo) {
                  const datos = new FormData()
                  datos.set("file", archivo)
                  const subida = await uploadPaymentReceipt(companyId, datos)
                  if (!subida.ok || !subida.path) {
                    toast.error(subida.error ?? "No se pudo subir el comprobante.")
                    return
                  }
                  voucher = subida.path
                }

                const r = await savePayment({
                  id: registro?.id,
                  company_id: companyId,
                  branch_id: venta.branch_id,
                  sale_id: venta.id || null,
                  ref_credito: venta.ref_credito,
                  report_date: fecha,
                  titular_id: venta.documento,
                  titular_nombre: venta.cliente,
                  amount: monto,
                  method_code: valorOpcional(medio),
                  recibo: recibo.trim() || null,
                  voucher,
                })
                if (!r.ok) {
                  toast.error(r.error ?? "No se pudo guardar el pago.")
                  return
                }
                toast.success(editando ? "Pago actualizado" : "Pago registrado", {
                  description: `${venta.cliente} · ${formatCOP(monto)}`,
                })
                if (!editando) limpiar()
                setOpen(false)
              })
            }
          >
            <Save className="size-4" />
            {pendiente ? "Guardando…" : editando ? "Guardar cambios" : "Guardar pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
