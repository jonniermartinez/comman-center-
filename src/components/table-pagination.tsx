"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * Pie de tabla: cuántos registros hay y en qué página vamos.
 *
 * Se pagina en el cliente porque los listados de captura de un mes caben de
 * sobra en memoria; lo que se busca acá es que la tabla no crezca más allá del
 * alto de la pantalla, no ahorrar consultas.
 */
export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}) {
  const paginas = Math.max(1, Math.ceil(total / pageSize))
  const desde = total === 0 ? 0 : page * pageSize + 1
  const hasta = Math.min(total, (page + 1) * pageSize)

  if (total <= pageSize) return null

  return (
    <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm">
      <p className="text-muted-foreground tabular-nums">
        {desde}–{hasta} de {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-4" />
          Anterior
        </Button>
        <span className="text-muted-foreground tabular-nums">
          {page + 1} / {paginas}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page + 1 >= paginas}
          onClick={() => onPageChange(page + 1)}
        >
          Siguiente
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
