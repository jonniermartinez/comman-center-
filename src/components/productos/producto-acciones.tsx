"use client"

import { Archive, ArchiveRestore, MoreHorizontal, Trash2 } from "lucide-react"
import { useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { archiveCompanyProduct, deleteCompanyProduct } from "@/lib/data/products-actions"
import type { ProductoDeEmpresa } from "@/lib/data/products"

/**
 * Archivar o borrar un producto.
 *
 * Borrar solo se ofrece cuando nadie lo ha vendido. Con ventas encima, lo que
 * corresponde es archivarlo: desaparece de las ventas nuevas y las viejas
 * siguen sabiendo qué se vendió.
 */
export function ProductoAcciones({ producto }: { producto: ProductoDeEmpresa }) {
  const [pendiente, startTransition] = useTransition()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" disabled={pendiente}>
          <MoreHorizontal className="size-4" />
          <span className="sr-only">Acciones de {producto.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={() =>
            startTransition(async () => {
              const r = await archiveCompanyProduct(producto.id, producto.active)
              if (r.ok) {
                toast.success(producto.active ? `${producto.name} archivado` : `${producto.name} disponible`)
              } else {
                toast.error(r.error)
              }
            })
          }
        >
          {producto.active ? (
            <>
              <Archive className="size-4" />
              Archivar
            </>
          ) : (
            <>
              <ArchiveRestore className="size-4" />
              Volver a ofrecer
            </>
          )}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="destructive"
          onSelect={() =>
            startTransition(async () => {
              const r = await deleteCompanyProduct(producto.id)
              if (r.ok) toast.success(`${producto.name} eliminado`)
              else toast.error(r.error)
            })
          }
        >
          <Trash2 className="size-4" />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
