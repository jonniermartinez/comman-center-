"use client"

import { MessageCircle, Pencil, Plus, Save, Trash2 } from "lucide-react"
import { useEffect, useState, useTransition } from "react"
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
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { ProductoVendible } from "@/lib/data/company"
import { getSaleDetail, saveSale } from "@/lib/data/records-actions"
import { formatCOP, todayISO } from "@/lib/format"
import { enlaceWhatsApp } from "@/lib/whatsapp"

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
  company_product_id: string | null
  school_code: string | null
  state_code: string | null
  traffic_code: string | null
  licencia_nombre: string | null
  licencia_id: string | null
  licencia_celular: string | null
  credito_nombre: string | null
  credito_id: string | null
  credito_celular: string | null
  valor_inicial: number
  adicion: number
  descuento: number
  valor_final: number
  recaudo: number
  cantidad_final: number
  observacion: string | null
}

interface BonoElegido {
  bonus_id: string | null
  name: string
  amount: number
}

interface Adicion {
  concepto: string
  amount: number
}

interface LineaFinanciacion {
  financing_code: string
  valor: number
  abono: number
  cuota: number
  titular_nombre: string
  titular_id: string
}

/**
 * Alta de una venta.
 *
 * El formulario sigue el orden en que ocurre la venta: quién compra, qué
 * compra, cómo lo paga y cuánto queda. Tres cosas no se digitan porque
 * digitarlas es de donde salen los descuadres:
 *
 *   * El precio lo pone el producto de la lista de la empresa.
 *   * La rebaja solo puede ser un bono autorizado de ese producto.
 *   * El saldo es el valor final menos los pagos, y los pagos van en su módulo.
 *
 * Una venta guardada no se edita: la política de la base solo deja al super
 * admin (039), así que a los demás ni se les ofrece el lápiz.
 */
export function NuevaVenta({
  companyId,
  branches,
  staff,
  financiaciones,
  productosEmpresa,
  traficos,
  escuelas,
  estados,
  canManage,
  isSuperAdmin,
  myStaffId,
  registro,
}: {
  companyId: string
  branches: { id: string; name: string; is_primary: boolean }[]
  staff: { id: string; full_name: string }[]
  financiaciones: Catalogo[]
  productosEmpresa: ProductoVendible[]
  traficos: Catalogo[]
  escuelas: Catalogo[]
  estados: Catalogo[]
  /** Quien administra registra a nombre de cualquiera; el comercial, lo suyo. */
  canManage: boolean
  /** Solo el super admin puede corregir una venta ya guardada. */
  isSuperAdmin: boolean
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

  // El crédito a nombre del mismo titular es el caso normal; el otro es el
  // padre que financia el curso del hijo. Se arranca en "sí" y solo si alguien
  // lo apaga aparecen los campos del otro titular: preguntarlo siempre con seis
  // casillas vacías es pedirle trabajo al 90% de las ventas.
  const mismoTitular =
    !registro || !registro.credito_id || registro.credito_id === registro.licencia_id
  const [creditoIgual, setCreditoIgual] = useState(mismoTitular)
  const [creditoNombre, setCreditoNombre] = useState(registro?.credito_nombre ?? "")
  const [creditoDocumento, setCreditoDocumento] = useState(registro?.credito_id ?? "")
  const [creditoCelular, setCreditoCelular] = useState(registro?.credito_celular ?? "")

  const [productoId, setProductoId] = useState(registro?.company_product_id ?? "")
  const producto = productosEmpresa.find((p) => p.id === productoId)

  /*
   * El valor de lista de ESTA venta, que no siempre es el precio de hoy.
   *
   * Elegir un producto trae su precio, y esa es la gracia. Pero una venta ya
   * registrada se firmó con el precio que había ese día: abrirla y que el
   * formulario le pusiera el precio de la lista de hoy cambiaría en silencio
   * una cifra contra la que ya se liquidaron comisiones y se recibieron pagos.
   * Por eso el precio arranca en el de la venta y solo se pisa si alguien
   * cambia de producto, que ahí sí está pidiendo otro precio.
   *
   * Sin producto —empresa que no cargó su lista, o venta importada que no
   * apunta a ninguno— este mismo valor se digita a mano.
   */
  const [precioBase, setPrecioBase] = useState(Number(registro?.valor_inicial ?? 0))
  const valorLista = precioBase

  const [bonos, setBonos] = useState<BonoElegido[]>([])
  const [adiciones, setAdiciones] = useState<Adicion[]>([])

  const [financiacion, setFinanciacion] = useState(registro?.financing_code ?? "")
  const [lineas, setLineas] = useState<LineaFinanciacion[]>([])
  const [trafico, setTrafico] = useState(registro?.traffic_code ?? "")
  const [escuela, setEscuela] = useState(registro?.school_code ?? "")
  const [estado, setEstado] = useState(registro?.state_code ?? "")
  const [cantidad, setCantidad] = useState(Number(registro?.cantidad_final ?? 1))
  const [observacion, setObservacion] = useState(registro?.observacion ?? "")
  const [pendiente, startTransition] = useTransition()

  // El detalle de una venta guardada —sus bonos, sus adiciones, cómo se
  // repartió la financiación— no viaja con el listado: son tres consultas por
  // fila y en pantalla hay veinticinco. Se pide al abrir el formulario, y hasta
  // que llegue no se deja guardar: guardar antes reemplazaría ese detalle por
  // las listas vacías con las que arranca el estado.
  const [detalleListo, setDetalleListo] = useState(!editando)
  useEffect(() => {
    if (!open || !editando || detalleListo) return
    let vigente = true
    getSaleDetail(registro.id).then((d) => {
      if (!vigente) return
      setBonos(d.bonos.map((b) => ({ bonus_id: b.bonus_id ?? null, name: b.name, amount: b.amount })))
      setAdiciones(d.adiciones)
      setLineas(
        d.financiaciones.map((f) => ({
          financing_code: f.financing_code ?? "",
          valor: f.valor,
          abono: f.abono,
          cuota: f.cuota,
          titular_nombre: f.titular_nombre ?? "",
          titular_id: f.titular_id ?? "",
        })),
      )
      setDetalleListo(true)
    })
    return () => {
      vigente = false
    }
  }, [open, editando, detalleListo, registro?.id])

  const totalBonos = bonos.reduce((s, b) => s + b.amount, 0)
  const totalAdiciones = adiciones.reduce((s, a) => s + a.amount, 0)
  const valorFinal = Math.max(0, valorLista + totalAdiciones - totalBonos)

  // Lo recaudado son los pagos ya registrados contra esta venta; acá solo se
  // muestra para que el saldo cuadre con lo que se está editando.
  const recaudado = Number(registro?.recaudo ?? 0)
  // Sin piso en cero: un saldo negativo es un sobrepago y hay que verlo.
  const saldo = valorFinal - recaudado
  const persona = staff.find((s) => s.id === staffId)

  // "Mixta Addi", "Mixto", "Mixto Brilla": en el catálogo hay siete variantes y
  // todas quieren decir lo mismo —la venta se pagó por más de una vía—.
  const esMixta = financiacion.toLowerCase().startsWith("mixt")
  const repartido = lineas.reduce((s, l) => s + l.valor, 0)

  const valido =
    !!branchId &&
    nombre.trim().length > 2 &&
    valorFinal > 0 &&
    fecha <= hoy &&
    (creditoIgual || creditoNombre.trim().length > 2) &&
    (!esMixta || lineas.length > 0) &&
    detalleListo

  const cambiarLinea = (i: number, cambio: Partial<LineaFinanciacion>) =>
    setLineas((actual) => actual.map((l, j) => (i === j ? { ...l, ...cambio } : l)))

  const whatsapp = enlaceWhatsApp(celular)

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

        {/* ---------------- Titular de la licencia ---------------- */}
        <div className="grid gap-4 sm:grid-cols-3">
          <CampoTexto
            id="nombre"
            label="Titular de la licencia"
            value={nombre}
            onChange={setNombre}
            placeholder="Nombre completo"
          />
          <CampoTexto id="documento" label="Documento" value={documento} onChange={setDocumento} />
          <div className="min-w-0 space-y-2">
            <Label htmlFor="celular">Celular</Label>
            <div className="flex items-center gap-2">
              <Input id="celular" value={celular} onChange={(e) => setCelular(e.target.value)} />
              {/* El número ya está escrito: abrirlo en WhatsApp no debería
                  costar copiarlo, pegarlo y buscarlo en el teléfono. */}
              <Button
                asChild={!!whatsapp}
                variant="outline"
                size="icon"
                className="size-9 shrink-0"
                disabled={!whatsapp}
                title={whatsapp ? `Escribirle a ${nombre || "este número"}` : "Sin celular"}
              >
                {whatsapp ? (
                  <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="size-4" />
                    <span className="sr-only">Abrir WhatsApp</span>
                  </a>
                ) : (
                  <MessageCircle className="size-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* ---------------- Titular del crédito ---------------- */}
        <div className="space-y-3 rounded-lg border px-4 py-3">
          <div className="flex items-start gap-3">
            <Switch id="credito-igual" checked={creditoIgual} onCheckedChange={setCreditoIgual} />
            <div className="space-y-0.5">
              <Label htmlFor="credito-igual">El crédito va a nombre del mismo titular</Label>
              <p className="text-xs text-muted-foreground">
                Apágalo cuando quien firma la financiación no es quien va a manejar: un padre que
                financia el curso del hijo, por ejemplo.
              </p>
            </div>
          </div>

          {!creditoIgual && (
            <div className="grid gap-4 sm:grid-cols-3">
              <CampoTexto
                id="credito-nombre"
                label="Titular del crédito"
                value={creditoNombre}
                onChange={setCreditoNombre}
                placeholder="Nombre completo"
              />
              <CampoTexto
                id="credito-documento"
                label="Documento"
                value={creditoDocumento}
                onChange={setCreditoDocumento}
              />
              <CampoTexto
                id="credito-celular"
                label="Celular"
                value={creditoCelular}
                onChange={setCreditoCelular}
              />
            </div>
          )}
        </div>

        {/* ---------------- Qué compró ---------------- */}
        <div className="grid gap-4 sm:grid-cols-4">
          {productosEmpresa.length > 0 && (
            <CampoSelect
              id="producto"
              label="Producto"
              value={productoId}
              onChange={(v) => {
                setProductoId(v)
                // Los bonos son de un producto: al cambiarlo, los que estaban
                // aplicados ya no existen.
                setBonos([])
                const elegido = productosEmpresa.find((p) => p.id === v)
                if (elegido) setPrecioBase(elegido.price)
              }}
              vacio="Sin definir"
              options={productosEmpresa.map((p) => ({
                value: p.id,
                label: `${p.name} · ${formatCOP(p.price)}`,
              }))}
            />
          )}
          {/* Sin producto elegido el valor se digita: puede ser una empresa
              que todavía no cargó su lista, o una venta vieja importada del
              Excel que no apunta a ningún producto. */}
          {!producto && (
            <div className="min-w-0 space-y-2">
              <Label htmlFor="valor">Valor</Label>
              <MoneyInput id="valor" value={precioBase} onValueChange={setPrecioBase} />
            </div>
          )}
          <CampoSelect
            id="trafico"
            label="Tráfico"
            value={trafico}
            onChange={setTrafico}
            vacio="Sin definir"
            options={traficos.map((t) => ({ value: t.code, label: t.name }))}
          />
          <CampoSelect
            id="escuela"
            label="Escuela"
            value={escuela}
            onChange={setEscuela}
            vacio="Sin definir"
            options={escuelas.map((e) => ({ value: e.code, label: e.name }))}
          />
          <CampoSelect
            id="estado"
            label="Estado del trámite"
            value={estado}
            onChange={setEstado}
            vacio="Sin definir"
            options={estados.map((e) => ({ value: e.code, label: e.name }))}
          />
        </div>

        {producto && producto.price !== precioBase && (
          <p className="text-xs text-muted-foreground">
            Esta venta se registró por {formatCOP(precioBase)}. El precio de {producto.name} en la
            lista de hoy es {formatCOP(producto.price)}; se respeta el de la venta.
          </p>
        )}

        {/* ---------------- Bonos del producto ---------------- */}
        {producto && producto.bonos.length > 0 && (
          <div className="space-y-2">
            <Label>Bonos autorizados</Label>
            <div className="flex flex-wrap gap-2">
              {producto.bonos.map((bono) => {
                const aplicado = bonos.some((b) => b.bonus_id === bono.id)
                return (
                  <Button
                    key={bono.id}
                    type="button"
                    variant={aplicado ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      setBonos((actual) =>
                        aplicado
                          ? actual.filter((b) => b.bonus_id !== bono.id)
                          : [...actual, { bonus_id: bono.id, name: bono.name, amount: bono.amount }],
                      )
                    }
                  >
                    {bono.name} · −{formatCOP(bono.amount)}
                  </Button>
                )
              })}
            </div>
          </div>
        )}

        {/* ---------------- Adiciones ---------------- */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Adiciones</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAdiciones((a) => [...a, { concepto: "", amount: 0 }])}
            >
              <Plus className="size-4" />
              Agregar
            </Button>
          </div>
          {adiciones.map((adicion, i) => (
            <div key={i} className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
              <Input
                value={adicion.concepto}
                onChange={(e) =>
                  setAdiciones((actual) =>
                    actual.map((a, j) => (i === j ? { ...a, concepto: e.target.value } : a)),
                  )
                }
                placeholder="Examen médico, curso adicional…"
                aria-label={`Concepto de la adición ${i + 1}`}
              />
              <MoneyInput
                value={adicion.amount}
                onValueChange={(v) =>
                  setAdiciones((actual) =>
                    actual.map((a, j) => (i === j ? { ...a, amount: v } : a)),
                  )
                }
                aria-label={`Valor de la adición ${i + 1}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9"
                onClick={() => setAdiciones((actual) => actual.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-4" />
                <span className="sr-only">Quitar la adición {i + 1}</span>
              </Button>
            </div>
          ))}
        </div>

        {/* ---------------- Financiación ---------------- */}
        <div className="grid gap-4 sm:grid-cols-3">
          <CampoSelect
            id="financiacion"
            label="Financiación"
            value={financiacion}
            onChange={setFinanciacion}
            vacio="Sin definir"
            options={financiaciones.map((f) => ({ value: f.code, label: f.name }))}
          />
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

        {esMixta && (
          <div className="space-y-3 rounded-lg border px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Cómo se repartió</Label>
                <p className="text-xs text-muted-foreground">
                  Una línea por cada vía de pago, con su abono, su cuota y quién la firma.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setLineas((l) => [
                    ...l,
                    {
                      financing_code: "",
                      valor: 0,
                      abono: 0,
                      cuota: 0,
                      titular_nombre: "",
                      titular_id: "",
                    },
                  ])
                }
              >
                <Plus className="size-4" />
                Agregar financiación
              </Button>
            </div>

            {lineas.map((linea, i) => (
              <div key={i} className="grid gap-3 rounded-lg bg-muted/30 px-3 py-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                  <CampoSelect
                    id={`linea-tipo-${i}`}
                    label="Tipo"
                    value={linea.financing_code}
                    onChange={(v) => cambiarLinea(i, { financing_code: v })}
                    vacio="Sin definir"
                    options={financiaciones.map((f) => ({ value: f.code, label: f.name }))}
                  />
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor={`linea-valor-${i}`}>Valor</Label>
                    <MoneyInput
                      id={`linea-valor-${i}`}
                      value={linea.valor}
                      onValueChange={(v) => cambiarLinea(i, { valor: v })}
                    />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor={`linea-abono-${i}`}>Abono</Label>
                    <MoneyInput
                      id={`linea-abono-${i}`}
                      value={linea.abono}
                      onValueChange={(v) => cambiarLinea(i, { abono: v })}
                    />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor={`linea-cuota-${i}`}>Cuota</Label>
                    <MoneyInput
                      id={`linea-cuota-${i}`}
                      value={linea.cuota}
                      onValueChange={(v) => cambiarLinea(i, { cuota: v })}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 self-end"
                    onClick={() => setLineas((actual) => actual.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="size-4" />
                    <span className="sr-only">Quitar la financiación {i + 1}</span>
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <CampoTexto
                    id={`linea-titular-${i}`}
                    label="Titular de esta financiación"
                    value={linea.titular_nombre}
                    onChange={(v) => cambiarLinea(i, { titular_nombre: v })}
                    placeholder={creditoIgual ? nombre : creditoNombre}
                  />
                  <CampoTexto
                    id={`linea-titular-id-${i}`}
                    label="Documento"
                    value={linea.titular_id}
                    onChange={(v) => cambiarLinea(i, { titular_id: v })}
                  />
                </div>
              </div>
            ))}

            {lineas.length > 0 && repartido !== valorFinal && (
              <p className="text-xs text-amber-600">
                Las líneas suman {formatCOP(repartido)} y la venta vale {formatCOP(valorFinal)}:
                faltan {formatCOP(Math.abs(valorFinal - repartido))} por repartir.
              </p>
            )}
          </div>
        )}

        {/* ---------------- Cómo queda ---------------- */}
        <div className="grid gap-2 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span>
              Valor de lista: <strong className="tabular-nums">{formatCOP(valorLista)}</strong>
            </span>
            <span>
              Bonos:{" "}
              <strong className="tabular-nums">
                {totalBonos ? `−${formatCOP(totalBonos)}` : formatCOP(0)}
              </strong>
            </span>
            <span>
              Adiciones:{" "}
              <strong className="tabular-nums">
                {totalAdiciones ? `+${formatCOP(totalAdiciones)}` : formatCOP(0)}
              </strong>
            </span>
            <span>
              Valor final: <strong className="tabular-nums">{formatCOP(valorFinal)}</strong>
            </span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span>
              Recaudado: <strong className="tabular-nums">{formatCOP(recaudado)}</strong>
            </span>
            <span>
              Saldo:{" "}
              <strong className={saldo > 0 ? "tabular-nums text-amber-600" : "tabular-nums"}>
                {formatCOP(saldo)}
              </strong>
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            El recaudo se registra en Pagos, no acá: el saldo es el valor final menos los pagos de
            esta venta.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="obs">Observación (opcional)</Label>
          <Textarea
            id="obs"
            rows={2}
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
          />
        </div>

        {!editando && (
          <p className="text-xs text-muted-foreground">
            Al guardar, la venta queda firmada: corregirla después solo lo puede hacer el super
            admin.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!valido || pendiente || (editando && !isSuperAdmin)}
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
                  company_product_id: valorOpcional(productoId),
                  product_code: registro?.product_code ?? null,
                  school_code: valorOpcional(escuela),
                  state_code: valorOpcional(estado),
                  traffic_code: valorOpcional(trafico),
                  licencia_nombre: nombre.trim(),
                  licencia_id: documento.trim() || null,
                  licencia_celular: celular.trim() || null,
                  credito_nombre: creditoIgual ? nombre.trim() : creditoNombre.trim(),
                  credito_id: creditoIgual ? documento.trim() || null : creditoDocumento.trim() || null,
                  credito_celular: creditoIgual
                    ? celular.trim() || null
                    : creditoCelular.trim() || null,
                  valor_inicial: valorLista,
                  adicion: totalAdiciones,
                  descuento: totalBonos,
                  valor_final: valorFinal,
                  cantidad_final: cantidad,
                  observacion: observacion.trim() || null,
                  bonos: bonos.map((b) => ({
                    bonus_id: b.bonus_id,
                    name: b.name,
                    amount: b.amount,
                  })),
                  adiciones: adiciones
                    .filter((a) => a.concepto.trim() && a.amount > 0)
                    .map((a) => ({ concepto: a.concepto.trim(), amount: a.amount })),
                  financiaciones: esMixta
                    ? lineas.map((l) => ({
                        financing_code: valorOpcional(l.financing_code),
                        valor: l.valor,
                        abono: l.abono,
                        cuota: l.cuota,
                        titular_nombre: l.titular_nombre.trim() || null,
                        titular_id: l.titular_id.trim() || null,
                      }))
                    : [],
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
