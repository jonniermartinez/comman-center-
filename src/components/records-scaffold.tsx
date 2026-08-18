import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"

/**
 * Estructura común de los módulos de registros.
 *
 * Lo primero que se ve es lo ya registrado, con sus filtros y su paginación.
 * La paginación son enlaces, no estado del cliente: la página está en la URL,
 * así que compartir un enlace o volver atrás funciona como uno espera.
 */
export function RecordsScaffold({
  title,
  description,
  actions,
  filters,
  summary,
  total,
  page,
  pageSize,
  hrefPagina,
  children,
  footer,
}: {
  title: string
  description: string
  actions?: React.ReactNode
  filters?: React.ReactNode
  /** Franja de totales del rango filtrado. */
  summary?: React.ReactNode
  total: number
  page: number
  pageSize: number
  /** Construye el enlace a otra página conservando los filtros. */
  hrefPagina: (page: number) => string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  const paginas = Math.max(1, Math.ceil(total / pageSize))
  const desde = total === 0 ? 0 : page * pageSize + 1
  const hasta = Math.min(total, (page + 1) * pageSize)

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title={title} description={description} actions={actions} />

      {filters}
      {summary}

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b px-4 py-3 text-sm tabular-nums text-muted-foreground">
          {total.toLocaleString("es-CO")} {total === 1 ? "registro" : "registros"}
        </div>

        <div className="overflow-x-auto">{children}</div>

        {total > pageSize && (
          <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm">
            <p className="tabular-nums text-muted-foreground">
              {desde.toLocaleString("es-CO")}–{hasta.toLocaleString("es-CO")} de{" "}
              {total.toLocaleString("es-CO")}
            </p>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm" disabled={page === 0}>
                <Link href={hrefPagina(Math.max(0, page - 1))} aria-disabled={page === 0}>
                  <ChevronLeft className="size-4" />
                  Anterior
                </Link>
              </Button>
              <span className="tabular-nums text-muted-foreground">
                {page + 1} / {paginas.toLocaleString("es-CO")}
              </span>
              <Button asChild variant="outline" size="sm">
                <Link href={hrefPagina(Math.min(paginas - 1, page + 1))}>
                  Siguiente
                  <ChevronRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>

      {footer}
    </div>
  )
}

/** Fila vacía, con el mismo mensaje en todos los módulos. */
export function EmptyRow({ colSpan, filtrando }: { colSpan: number; filtrando: boolean }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-10 text-center text-sm text-muted-foreground">
        {filtrando
          ? "Ningún registro coincide con el filtro."
          : "Todavía no hay registros en este módulo."}
      </td>
    </tr>
  )
}
