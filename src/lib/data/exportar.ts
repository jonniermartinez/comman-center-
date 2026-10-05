import "server-only"

import type { Filtros } from "@/lib/data/records"
import { formatDate, todayISO } from "@/lib/format"
import { crearXlsx, type HojaXlsx } from "@/lib/xlsx"

/** El rango del filtro en palabras, para el encabezado y el nombre del archivo. */
export function periodoDe(filtros: Filtros): string {
  if (filtros.desde && filtros.hasta) {
    return filtros.desde === filtros.hasta
      ? formatDate(filtros.desde)
      : `${formatDate(filtros.desde)} – ${formatDate(filtros.hasta)}`
  }
  if (filtros.desde) return `Desde ${formatDate(filtros.desde)}`
  if (filtros.hasta) return `Hasta ${formatDate(filtros.hasta)}`
  return "Todo el histórico"
}

/**
 * Las líneas que van encima de la tabla: qué es, de qué empresa, qué rango y
 * cuándo se exportó. Un Excel suelto en una carpeta no trae la URL de la que
 * salió, así que el filtro tiene que quedar escrito adentro.
 */
export function encabezadoDe(
  modulo: string,
  empresa: string,
  filtros: Filtros,
  detalle: { filas: number; truncado: boolean; otros?: (string | null | undefined)[] },
): string[] {
  const ahora = new Date().toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "short",
    timeStyle: "short",
  })
  const otros = [
    filtros.archivadas ? "Solo archivadas" : null,
    filtros.q ? `Búsqueda: "${filtros.q}"` : null,
    ...(detalle.otros ?? []),
  ].filter(Boolean)
  return [
    `${modulo} · ${empresa}`,
    `Período: ${periodoDe(filtros)}${otros.length ? ` · ${otros.join(" · ")}` : ""}`,
    `Exportado el ${ahora} · ${detalle.filas.toLocaleString("es-CO")} registro(s)${
      detalle.truncado ? " (el filtro alcanzaba más: acote el rango)" : ""
    }`,
  ]
}

/** La respuesta que hace que el navegador descargue el libro. */
export async function descargaXlsx(hoja: HojaXlsx, slug: string, filtros: Filtros): Promise<Response> {
  const rango =
    filtros.desde || filtros.hasta
      ? `${filtros.desde ?? "inicio"}_a_${filtros.hasta ?? todayISO()}`
      : "todo"
  const archivo = `${hoja.nombre.toLowerCase()}-${slug}-${rango}.xlsx`
  return new Response((await crearXlsx(hoja)) as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${archivo}"`,
      "Cache-Control": "no-store",
    },
  })
}
