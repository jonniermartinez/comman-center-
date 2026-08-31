import { agenda, diaDistinto, jornada, movimiento, pago, venta } from "./datos"
import type { Registro } from "./matriz"

/**
 * Qué es cada registro para la matriz de capacidades.
 *
 * Cada módulo importa el suyo. Están juntos porque las diferencias entre ellos
 * —quién lleva responsable, qué se puede borrar, cuál es solo de quien
 * administra— se entienden mejor de un vistazo que repartidas por cinco
 * archivos.
 */

export const VENTA: Registro = {
  singular: "venta",
  modulo: "Ventas",
  tabla: "sales",
  campoEditable: "observacion",
  fila: venta,
  conResponsable: true,
  borrable: true,
}

export const PAGO: Registro = {
  singular: "pago",
  modulo: "Pagos",
  tabla: "payments",
  campoEditable: "observacion",
  fila: pago,
  conResponsable: false,
  borrable: true,
}

export const AGENDA: Registro = {
  singular: "agenda",
  modulo: "Agendas",
  tabla: "appointments",
  campoEditable: "observacion",
  fila: agenda,
  conResponsable: true,
  borrable: true,
}

export const CAJA: Registro = {
  singular: "movimiento de caja",
  modulo: "Caja",
  tabla: "cash_movements",
  campoEditable: "observacion",
  fila: movimiento,
  conResponsable: false,
  borrable: true,
  soloAdmin: true,
}

export const JORNADA: Registro = {
  singular: "jornada",
  modulo: "Gestión diaria",
  tabla: "daily_activity",
  campoEditable: "notas",
  fila: jornada,
  conResponsable: true,
  borrable: true,
  unico: diaDistinto,
}
