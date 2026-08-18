"use client"

import { Plus } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { TablePagination } from "@/components/table-pagination"
import { Button } from "@/components/ui/button"

/**
 * Estructura común de los módulos de captura.
 *
 * Los tres funcionan igual: lo primero que se ve es **lo ya registrado**, y
 * capturar es una acción puntual que abre un formulario en una ventana. Antes
 * la pantalla era el formulario y los registros no se veían: para corregir algo
 * había que adivinar la combinación de fecha, responsable y jornada.
 */
export function RecordsScaffold({
  title,
  description,
  newLabel = "Nuevo registro",
  onNew,
  filters,
  total,
  page,
  pageSize,
  onPageChange,
  children,
  footer,
}: {
  title: string
  description: string
  newLabel?: string
  onNew: () => void
  filters?: React.ReactNode
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  /** La tabla de registros. */
  children: React.ReactNode
  /** Contenido extra debajo del listado (resúmenes calculados, por ejemplo). */
  footer?: React.ReactNode
}) {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={title}
        description={description}
        actions={
          <Button onClick={onNew}>
            <Plus className="size-4" />
            {newLabel}
          </Button>
        }
      />

      {filters && <div className="mb-4 flex flex-wrap items-end gap-3">{filters}</div>}

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b px-4 py-3 text-sm text-muted-foreground tabular-nums">
          {total} {total === 1 ? "registro" : "registros"}
        </div>

        <div className="overflow-x-auto">{children}</div>

        <TablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={onPageChange}
        />
      </div>

      {footer}
    </div>
  )
}

/** Fila vacía de una tabla de registros, con el mismo mensaje en los tres módulos. */
export function EmptyRow({ colSpan, filtrando }: { colSpan: number; filtrando: boolean }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-10 text-center text-sm text-muted-foreground">
        {filtrando
          ? "Ningún registro coincide con el filtro."
          : "Todavía no hay registros. Crea el primero con «Nuevo registro»."}
      </td>
    </tr>
  )
}
