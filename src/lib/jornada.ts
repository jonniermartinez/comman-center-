/**
 * Los totales de una jornada, calculados igual que en `v_daily_activity`.
 *
 * Existen en TypeScript solo para mostrarlos mientras se digita: el número que
 * se guarda y el que leen los tableros lo calcula Postgres. Si esta suma y la
 * de la vista se separan, gana la vista.
 */
export interface TipificacionesJornada {
  llamada_no_contestada: number
  llamada_efectiva: number
  llamada_seguimiento: number
  llamada_agenda: number
  llamada_no_interesado: number
  llamada_postventa: number
  agenda_confirmada: number
  agenda_posible: number
  agenda_reprograma: number
  agenda_no_contesta: number
  agenda_cancela: number
  atencion_venta: number
  atencion_venta_externa: number
  atencion_seguimiento: number
  atencion_declinado: number
  atencion_asociado: number
  atencion_enrolamiento: number
  atencion_certificados: number
  atencion_renovacion: number
}

export function totalesJornada(v: TipificacionesJornada) {
  const llamadas_contestadas =
    v.llamada_efectiva +
    v.llamada_seguimiento +
    v.llamada_agenda +
    v.llamada_no_interesado +
    v.llamada_postventa
  return {
    llamadas_contestadas,
    total_llamadas: llamadas_contestadas + v.llamada_no_contestada,
    total_agendas:
      v.agenda_confirmada +
      v.agenda_posible +
      v.agenda_reprograma +
      v.agenda_no_contesta +
      v.agenda_cancela,
    total_atencion:
      v.atencion_venta + v.atencion_venta_externa + v.atencion_seguimiento + v.atencion_declinado,
    total_administrativa:
      v.atencion_asociado +
      v.atencion_enrolamiento +
      v.atencion_certificados +
      v.atencion_renovacion,
  }
}
