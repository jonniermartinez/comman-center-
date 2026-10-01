"use client"

import { FileDown } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Descarga en PDF el informe de la pantalla que se está viendo.
 *
 * El botón solo abre la impresión del navegador ("Guardar como PDF"). Lo que
 * sale no es la pantalla: cada página que lo usa trae al lado un informe
 * (`components/informes`) que solo existe en papel, maquetado como documento.
 * Va en el tema que la persona esté usando.
 */
export function ExportarPdf({
  titulo,
  empresa,
  periodo,
}: {
  /** El módulo: "Indicadores", "Dashboard". */
  titulo: string
  empresa: string
  /** El período que muestra la pantalla, ya en palabras. */
  periodo: string
}) {
  function exportar() {
    const tituloPagina = document.title
    // El navegador propone el título de la página como nombre del archivo.
    document.title = `${titulo} ${empresa} - ${periodo}`.replace(/[/\\:]/g, "-")
    window.addEventListener("afterprint", () => (document.title = tituloPagina), { once: true })
    window.print()
  }

  return (
    <Button type="button" variant="outline" onClick={exportar}>
      <FileDown className="size-4" />
      Descargar PDF
    </Button>
  )
}
