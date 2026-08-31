"use client"

import { Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"

import { Alert, AlertDescription } from "@/components/ui/alert"
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
import {
  companyDataCounts,
  deleteCompanyForever,
  type CompanyDataCounts,
} from "@/lib/data/companies-actions"

const FILAS: { key: keyof CompanyDataCounts; label: string }[] = [
  { key: "sedes", label: "Sedes" },
  { key: "usuarios", label: "Usuarios asignados" },
  { key: "comerciales", label: "Comerciales" },
  { key: "actividad", label: "Días de actividad diaria" },
  { key: "ventas", label: "Ventas" },
  { key: "pagos", label: "Pagos" },
  { key: "caja", label: "Movimientos de caja" },
  { key: "agendas", label: "Agendas" },
  { key: "objetivos", label: "Objetivos" },
]

/**
 * Borrado definitivo de una empresa.
 *
 * A diferencia de archivar, esto no se puede deshacer, así que la pantalla hace
 * dos cosas antes de dejar continuar: enseña cuántos registros se van a perder
 * —contados en la base, no estimados— y exige escribir el nombre de la empresa.
 * Solo lo ve el super admin, y la base vuelve a comprobarlo por su cuenta.
 */
export function DeleteCompanyDialog({
  companyId,
  companyName,
  open,
  onOpenChange,
  onDeleted,
}: {
  companyId: string
  companyName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Por defecto vuelve al listado de empresas. */
  onDeleted?: () => void
}) {
  const router = useRouter()
  const [confirmacion, setConfirmacion] = useState("")
  const [conteos, setConteos] = useState<CompanyDataCounts | null>(null)
  const [errorConteo, setErrorConteo] = useState<string | null>(null)
  const [pendiente, startTransition] = useTransition()

  // Se cuenta al abrir. Cerrar limpia lo escrito: el diálogo vive montado en la
  // tarjeta de la empresa y sin esto, al reabrirlo, seguiría ahí el nombre de
  // la vez anterior —ya confirmado— con el botón de borrar habilitado.
  function cambiarApertura(siguiente: boolean) {
    if (!siguiente) {
      setConfirmacion("")
      setConteos(null)
      setErrorConteo(null)
    }
    onOpenChange(siguiente)
  }

  useEffect(() => {
    if (!open) return
    let vigente = true
    companyDataCounts(companyId).then((r) => {
      if (!vigente) return
      setConteos(r.counts ?? null)
      setErrorConteo(r.error ?? null)
    })
    return () => {
      vigente = false
    }
  }, [open, companyId])

  const total = conteos ? Object.values(conteos).reduce((a, b) => a + Number(b), 0) : 0
  const coincide =
    confirmacion.trim().toLowerCase() === companyName.trim().toLowerCase()

  return (
    <Dialog open={open} onOpenChange={cambiarApertura}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar {companyName} definitivamente</DialogTitle>
          <DialogDescription>
            Se borra la empresa y <strong>todos sus datos</strong>. No hay papelera ni forma de
            recuperarlos. Si solo quieres sacarla de circulación, archívala: eso conserva el
            histórico y se puede revertir.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border">
            {errorConteo ? (
              <p className="p-3 text-sm text-destructive">
                No se pudo contar lo que se va a borrar: {errorConteo}
              </p>
            ) : conteos === null ? (
              <p className="p-3 text-sm text-muted-foreground">Contando lo que se va a borrar…</p>
            ) : (
              <ul className="divide-y text-sm">
                {FILAS.map((fila) => (
                  <li key={fila.key} className="flex justify-between px-3 py-2">
                    <span className="text-muted-foreground">{fila.label}</span>
                    <span className="font-medium tabular-nums">{Number(conteos[fila.key])}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {total > 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                Se perderán {total} registro(s). Los reportes históricos que los incluían dejarán
                de cuadrar.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="confirmar">
              Escribe <span className="font-semibold">{companyName}</span> para confirmar
            </Label>
            <Input
              id="confirmar"
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
              autoComplete="off"
              placeholder={companyName}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => cambiarApertura(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={!coincide || pendiente || conteos === null}
            onClick={() =>
              startTransition(async () => {
                const r = await deleteCompanyForever(companyId, confirmacion)
                if (!r.ok) {
                  toast.error(r.error ?? "No se pudo eliminar.")
                  return
                }
                toast.success(`${companyName} eliminada`, {
                  description: "La empresa y sus datos ya no existen en el sistema.",
                })
                cambiarApertura(false)
                if (onDeleted) onDeleted()
                else router.push("/empresas")
              })
            }
          >
            <Trash2 className="size-4" />
            {pendiente ? "Eliminando…" : "Eliminar para siempre"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
