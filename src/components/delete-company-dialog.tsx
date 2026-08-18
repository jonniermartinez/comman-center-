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
  { key: "usuarios", label: "Asignaciones de comerciales" },
  { key: "kpi", label: "Registros de KPI Diario" },
  { key: "gestion", label: "Registros de Gestión Diaria" },
  { key: "ventas", label: "Líneas de ventas" },
  { key: "facturacion", label: "Líneas de facturación" },
  { key: "recaudo", label: "Líneas de recaudo" },
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
  const [pendiente, startTransition] = useTransition()

  useEffect(() => {
    if (!open) {
      setConfirmacion("")
      setConteos(null)
      return
    }
    companyDataCounts(companyId).then(setConteos)
  }, [open, companyId])

  const total = conteos ? Object.values(conteos).reduce((a, b) => a + Number(b), 0) : 0
  const coincide =
    confirmacion.trim().toLowerCase() === companyName.trim().toLowerCase()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            {conteos === null ? (
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={!coincide || pendiente}
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
                onOpenChange(false)
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
