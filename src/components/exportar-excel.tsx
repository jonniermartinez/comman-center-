"use client"

import { FileSpreadsheet } from "lucide-react"
import { usePathname, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"

/**
 * Descarga en Excel lo que el listado está mostrando.
 *
 * Los filtros viven en la URL, así que basta con pasarle los mismos
 * parámetros a la ruta `exportar` del módulo: sale el rango, la sede, el
 * responsable y la búsqueda que se están viendo, con todas sus páginas.
 */
export function ExportarExcel() {
  const pathname = usePathname()
  const params = new URLSearchParams(useSearchParams().toString())
  params.delete("p")
  const query = params.toString()

  return (
    <Button asChild variant="outline">
      {/* Enlace normal y no <Link>: es una descarga, no una navegación. */}
      <a href={`${pathname}/exportar${query ? `?${query}` : ""}`} download>
        <FileSpreadsheet className="size-4" />
        Exportar Excel
      </a>
    </Button>
  )
}
