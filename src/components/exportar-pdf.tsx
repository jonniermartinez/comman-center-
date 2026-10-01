"use client"

import { FileDown } from "lucide-react"
import { useEffect, useState } from "react"
import { flushSync } from "react-dom"

import { Button } from "@/components/ui/button"
import { APP_NAME } from "@/lib/branding"

/**
 * Descarga en PDF la pantalla que se está viendo, tal como se ve.
 *
 * Usa la impresión del navegador ("Guardar como PDF") en vez de armar el PDF
 * aparte: así el documento es la misma pantalla —mismas placas, mismas
 * tablas, mismas gráficas— y no una segunda versión que haya que mantener
 * igual a mano. Sale en el tema que la persona esté usando: quien trabaja en
 * oscuro descarga el informe en oscuro, a hoja completa.
 *
 * El botón solo dispara la impresión. Lo que convierte la pantalla en informe
 * son los estilos de impresión de globals.css y `EncabezadoPdf`.
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

/**
 * La cabecera y el pie del informe. En pantalla no existen; al imprimir
 * reemplazan al encabezado de la página y dicen lo que un PDF suelto en una
 * carpeta ya no puede decir por sí solo: de qué empresa es, qué período
 * muestra y cuándo se sacó.
 */
export function EncabezadoPdf({
  titulo,
  empresa,
  periodo,
  detalle,
}: {
  titulo: string
  empresa: string
  periodo: string
  /** Una línea opcional bajo el título: a qué equipo o filtro corresponde. */
  detalle?: string
}) {
  const [exportado, setExportado] = useState("")

  // La fecha es la del momento en que se imprime, no la de cuando cargó la
  // página: se fija en `beforeprint`, también si imprimen con Ctrl+P.
  useEffect(() => {
    const fijar = () =>
      flushSync(() =>
        setExportado(new Date().toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" })),
      )
    window.addEventListener("beforeprint", fijar)
    return () => window.removeEventListener("beforeprint", fijar)
  }, [])

  return (
    <>
      <header className="mb-6 hidden overflow-hidden rounded-xl border bg-card print:block">
        <div className="h-1.5 bg-primary" />
        <div className="flex items-center justify-between gap-8 px-6 py-5">
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/command-center-simbolo.png"
              alt=""
              className="h-12 w-auto rounded-md bg-white p-1.5"
            />
            <div>
              <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                {APP_NAME} · {titulo}
              </p>
              <p className="text-2xl leading-tight font-semibold tracking-tight">{empresa}</p>
              {detalle && <p className="mt-0.5 text-xs text-muted-foreground">{detalle}</p>}
            </div>
          </div>
          <dl className="grid shrink-0 grid-cols-[auto_auto] items-baseline gap-x-4 gap-y-1 text-right text-xs">
            <dt className="text-muted-foreground">Período</dt>
            <dd className="text-sm font-semibold">{periodo}</dd>
            <dt className="text-muted-foreground">Exportado</dt>
            <dd className="font-medium">{exportado}</dd>
          </dl>
        </div>
      </header>
      <p className="pdf-pie hidden text-[9px] text-muted-foreground print:flex">
        <span>
          {APP_NAME} · {titulo} · {empresa} · {periodo}
        </span>
        <span>Exportado el {exportado}</span>
      </p>
    </>
  )
}
