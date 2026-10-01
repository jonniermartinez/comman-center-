"use client"

import { FileDown } from "lucide-react"
import { useState } from "react"
import { flushSync } from "react-dom"

import { Button } from "@/components/ui/button"

/**
 * Descarga en PDF la pantalla que se está viendo, tal como se ve.
 *
 * Usa la impresión del navegador ("Guardar como PDF") en vez de armar el PDF
 * aparte: así el documento es la misma pantalla —mismas placas, mismas
 * tablas, mismas gráficas— y no una segunda versión que haya que mantener
 * igual a mano. Los estilos de impresión (globals.css) quitan el menú y la
 * barra, y este componente deja escrito qué período es y cuándo se exportó.
 *
 * Se imprime siempre en tema claro: el oscuro gasta tinta y, sin los fondos,
 * deja texto claro sobre papel blanco.
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
  const [exportado, setExportado] = useState("")

  function exportar() {
    const html = document.documentElement
    const tema = html.getAttribute("data-theme")
    const tituloPagina = document.title

    // La fecha se fija al hacer clic y se pinta antes de abrir el diálogo.
    flushSync(() =>
      setExportado(new Date().toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" })),
    )
    html.setAttribute("data-theme", "light")
    // El navegador propone el título de la página como nombre del archivo.
    document.title = `${titulo} ${empresa} - ${periodo}`.replace(/[/\\:]/g, "-")

    window.addEventListener(
      "afterprint",
      () => {
        if (tema) html.setAttribute("data-theme", tema)
        document.title = tituloPagina
      },
      { once: true },
    )
    window.print()
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={exportar} className="print:hidden">
        <FileDown className="size-4" />
        Descargar PDF
      </Button>
      <dl className="hidden text-right text-xs print:block">
        <dt className="sr-only">Empresa</dt>
        <dd className="text-sm font-semibold">{empresa}</dd>
        <dt className="sr-only">Período</dt>
        <dd>Período: {periodo}</dd>
        <dt className="sr-only">Fecha de exportación</dt>
        <dd className="text-muted-foreground">Exportado el {exportado}</dd>
      </dl>
    </>
  )
}
