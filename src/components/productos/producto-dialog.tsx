"use client"

import { Pencil, Plus, Save, Trash2 } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

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
import { saveCompanyProduct } from "@/lib/data/products-actions"
import type { ProductoDeEmpresa } from "@/lib/data/products"
import { formatCOP } from "@/lib/format"

/** Una línea de bono mientras se edita: sin id si todavía no se guardó. */
interface BonoEnEdicion {
  id?: string
  name: string
  amount: number
}

/**
 * Alta y corrección de un producto de la lista de precios.
 *
 * El producto y sus bonos se editan juntos porque así se piensan: "el A2 vale
 * 1.200.000 y admite bono de referido". El bono siempre resta —es un descuento
 * que la empresa autoriza de antemano— y por eso el formulario enseña al lado
 * cuánto queda el producto con ese bono aplicado: es la cifra que va a ver el
 * cliente, y verla acá evita autorizar un bono que deja el curso por debajo del
 * costo.
 */
export function ProductoDialog({
  companyId,
  producto,
}: {
  companyId: string
  producto?: ProductoDeEmpresa
}) {
  const editando = !!producto
  const [open, setOpen] = useState(false)
  const [nombre, setNombre] = useState(producto?.name ?? "")
  const [precio, setPrecio] = useState(producto?.price ?? 0)
  const [esRenovacion, setEsRenovacion] = useState(producto?.is_renovacion ?? false)
  const [activo, setActivo] = useState(producto?.active ?? true)
  const [bonos, setBonos] = useState<BonoEnEdicion[]>(
    producto?.bonos.map((b) => ({ id: b.id, name: b.name, amount: b.amount })) ?? [],
  )
  const [pendiente, startTransition] = useTransition()

  const valido = nombre.trim().length > 1 && precio >= 0 && bonos.every((b) => b.name.trim())

  const cambiarBono = (i: number, cambio: Partial<BonoEnEdicion>) =>
    setBonos((actual) => actual.map((b, j) => (i === j ? { ...b, ...cambio } : b)))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editando ? (
          <Button variant="ghost" size="icon" className="size-8">
            <Pencil className="size-4" />
            <span className="sr-only">Editar {producto.name}</span>
          </Button>
        ) : (
          <Button>
            <Plus className="size-4" />
            Nuevo producto
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar producto" : "Nuevo producto"}</DialogTitle>
          <DialogDescription>
            Lo que vende esta empresa, con su precio y los bonos que autoriza. Es lo que el
            comercial elige al registrar una venta.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="min-w-0 space-y-2">
            <Label htmlFor="producto-nombre">Nombre</Label>
            <Input
              id="producto-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Curso A2, Renovación C1, Examen…"
            />
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="producto-precio">Precio</Label>
            <MoneyInput id="producto-precio" value={precio} onValueChange={setPrecio} />
          </div>
        </div>

        <div className="grid gap-3 rounded-lg border px-4 py-3 sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <Switch id="producto-renovacion" checked={esRenovacion} onCheckedChange={setEsRenovacion} />
            <div className="space-y-0.5">
              <Label htmlFor="producto-renovacion">Es una renovación</Label>
              <p className="text-xs text-muted-foreground">
                Los tableros cuentan las renovaciones aparte de las ventas nuevas.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Switch id="producto-activo" checked={activo} onCheckedChange={setActivo} />
            <div className="space-y-0.5">
              <Label htmlFor="producto-activo">Disponible</Label>
              <p className="text-xs text-muted-foreground">
                Si lo apagas deja de aparecer al registrar ventas nuevas. Las viejas no se tocan.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label>Bonos autorizados</Label>
              <p className="text-xs text-muted-foreground">
                Descuentos aprobados de antemano. El comercial aplica uno de estos; no inventa la
                rebaja.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setBonos((b) => [...b, { name: "", amount: 0 }])}
            >
              <Plus className="size-4" />
              Agregar bono
            </Button>
          </div>

          {bonos.length === 0 && (
            <p className="rounded-lg border border-dashed px-4 py-3 text-xs text-muted-foreground">
              Sin bonos: este producto se vende siempre a {formatCOP(precio)}.
            </p>
          )}

          {bonos.map((bono, i) => (
            <div key={bono.id ?? `nuevo-${i}`} className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
              <Input
                value={bono.name}
                onChange={(e) => cambiarBono(i, { name: e.target.value })}
                placeholder="Bono referido, Bono empresa…"
                aria-label={`Nombre del bono ${i + 1}`}
              />
              <div className="flex items-center gap-2">
                <MoneyInput
                  value={bono.amount}
                  onValueChange={(v) => cambiarBono(i, { amount: v })}
                  aria-label={`Valor del bono ${i + 1}`}
                />
                <span className="w-32 shrink-0 text-xs text-muted-foreground tabular-nums">
                  queda {formatCOP(Math.max(0, precio - bono.amount))}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9"
                onClick={() => setBonos((actual) => actual.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-4" />
                <span className="sr-only">Quitar el bono {bono.name || i + 1}</span>
              </Button>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!valido || pendiente}
            onClick={() =>
              startTransition(async () => {
                const r = await saveCompanyProduct({
                  id: producto?.id,
                  company_id: companyId,
                  name: nombre,
                  price: precio,
                  is_renovacion: esRenovacion,
                  active: activo,
                  catalog_code: producto?.catalog_code ?? null,
                  sort_order: producto?.sort_order ?? 0,
                  bonos: bonos
                    .filter((b) => b.name.trim())
                    .map((b) => ({ id: b.id, name: b.name, amount: b.amount })),
                })
                if (!r.ok) {
                  toast.error(r.error ?? "No se pudo guardar el producto.")
                  return
                }
                toast.success(editando ? "Producto actualizado" : "Producto creado", {
                  description: `${nombre} · ${formatCOP(precio)}`,
                })
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
