"use client"

import { Archive, ArchiveRestore } from "lucide-react"
import { useTransition } from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { archiveRecord } from "@/lib/data/records-actions"

/**
 * Archivar o restaurar una venta o un pago desde su fila.
 *
 * Archivar pide confirmación porque mueve las cifras del mes; restaurar no,
 * porque solo devuelve las cosas a como estaban.
 */
export function ArchivarRegistro({
  tipo,
  id,
  nombre,
  archivado,
}: {
  tipo: "venta" | "pago"
  id: string
  /** De quién es, para que la confirmación diga qué se está archivando. */
  nombre: string
  archivado: boolean
}) {
  const [pendiente, startTransition] = useTransition()
  const articulo = tipo === "venta" ? "la venta" : "el pago"

  function aplicar(archivar: boolean) {
    startTransition(async () => {
      const r = await archiveRecord(tipo, id, archivar)
      if (!r.ok) {
        toast.error(archivar ? "No se pudo archivar" : "No se pudo restaurar", {
          description: r.error,
        })
        return
      }
      const hecho = tipo === "venta" ? "Venta" : "Pago"
      const estado =
        tipo === "venta"
          ? archivar
            ? "archivada"
            : "restaurada"
          : archivar
            ? "archivado"
            : "restaurado"
      toast.success(`${hecho} de ${nombre} ${estado}`)
    })
  }

  if (archivado) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={pendiente}
        onClick={() => aplicar(false)}
      >
        <ArchiveRestore className="size-4" />
        <span className="sr-only">
          Restaurar {articulo} de {nombre}
        </span>
      </Button>
    )
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" disabled={pendiente}>
          <Archive className="size-4" />
          <span className="sr-only">
            Archivar {articulo} de {nombre}
          </span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            ¿Archivar {articulo} de {nombre}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {tipo === "venta"
              ? "Sale del listado y deja de contar en ventas, facturación, saldo e indicadores. Sus pagos se archivan con ella. No se borra: la encuentras con “Ver archivadas” y la puedes restaurar."
              : "Sale del listado y deja de contar en el recaudo y en el saldo de su venta. No se borra: lo encuentras con “Ver archivadas” y lo puedes restaurar."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => aplicar(true)}>Archivar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
