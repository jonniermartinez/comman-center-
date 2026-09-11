/**
 * Cuándo una venta deja de estar en curso y pasa a ser un aviso.
 *
 * Vive fuera del componente porque la pregunta se hace en los dos lados: el
 * listado de ventas la usa en el servidor para contar cuántas hay, y el aviso
 * de cada fila la usa en el cliente para pintarse.
 */

/** A los 85 días una venta sin certificar deja de ser normal. */
export const DIAS_PARA_ALERTA = 85

/**
 * Estados en los que ya no hay nada que recontactar: o el trámite terminó, o
 * la venta se cayó. Avisar sobre estos sería ruido que enseña a ignorar el
 * aviso de los que sí importan.
 */
export const ESTADOS_CERRADOS = new Set([
  "certificado",
  "anulado",
  "anulado_con_curso",
  "devolucion_total",
  "devolucion_con_examen",
])

/** Días corridos entre la venta y hoy. */
export function diasDesde(fecha: string, hoy: string): number {
  const ms = Date.parse(`${hoy}T00:00:00`) - Date.parse(`${fecha}T00:00:00`)
  return Math.floor(ms / 86_400_000)
}

export function necesitaSeguimiento(fecha: string, estado: string | null, hoy: string): boolean {
  if (estado && ESTADOS_CERRADOS.has(estado)) return false
  return diasDesde(fecha, hoy) >= DIAS_PARA_ALERTA
}
