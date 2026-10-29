/**
 * Lo que pesa un comprobante de pago, a lo sumo.
 *
 * Vive aparte de records-actions porque un archivo "use server" solo puede
 * exportar funciones, y este número lo necesitan los dos lados: el formulario,
 * para rechazar la foto antes de subirla, y la acción, que lo vuelve a revisar.
 * El `bodySizeLimit` de next.config.ts va un mega por encima para el multipart.
 */
export const MAX_COMPROBANTE = 5 * 1024 * 1024

/** El aviso de un archivo que pasa del tope, con el nombre para saber cuál. */
export function excedeComprobante(archivo: File): string | null {
  if (archivo.size <= MAX_COMPROBANTE) return null
  const megas = (archivo.size / 1024 / 1024).toFixed(1)
  return `${archivo.name} pesa ${megas} MB y el máximo es 5 MB. Toma una captura de pantalla del comprobante o una foto más liviana.`
}
