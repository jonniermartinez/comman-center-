/**
 * Los indicadores del tablero: qué se mide, contra qué meta y cómo se lee.
 *
 * Las sumas las hace Postgres (`indicadores_por_comercial`, migración 044).
 * Acá solo se arman los ratios sobre esas sumas y se comparan con la meta.
 * Un ratio se calcula sobre los totales del filtro, nunca promediando los
 * ratios de cada comercial: promediar ratios da un número falso.
 *
 * Las metas son las que fijó la gerencia en septiembre de 2026. Son una regla
 * del negocio, no un dato de cada empresa, así que viven acá y no en la base.
 */

import { safeRatio } from "@/lib/kpi"

/** Una fila de `indicadores_por_comercial`, ya con los números convertidos. */
export interface FilaIndicadores {
  staff_id: string | null
  responsable_nombre: string
  dias_laborados: number
  dias_tarde: number
  llamada_no_contestada: number
  llamada_efectiva: number
  llamada_seguimiento: number
  llamada_agenda: number
  llamada_no_interesado: number
  llamada_postventa: number
  llamadas_contestadas: number
  total_llamadas: number
  agenda_confirmada: number
  agenda_posible: number
  agenda_reprograma: number
  agenda_no_contesta: number
  agenda_cancela: number
  total_agendas: number
  atencion_venta: number
  atencion_venta_externa: number
  atencion_seguimiento: number
  atencion_declinado: number
  total_atencion: number
  atencion_agenda: number
  atencion_asociado: number
  atencion_enrolamiento: number
  atencion_certificados: number
  atencion_renovacion: number
  total_administrativa: number
  chats_inicial: number
  chats_medio: number
  chats_final: number
  tareas_inicial: number
  tareas_medio: number
  tareas_final: number
  caducadas_inicial: number
  caducadas_medio: number
  caducadas_final: number
  ventas_total: number
  ventas_presencial: number
  ventas_digital: number
  ventas_sin_tipo: number
  valor_final: number
  adicion: number
  descuento: number
}

const CAMPOS_SUMABLES = [
  "dias_laborados", "dias_tarde",
  "llamada_no_contestada", "llamada_efectiva", "llamada_seguimiento", "llamada_agenda",
  "llamada_no_interesado", "llamada_postventa", "llamadas_contestadas", "total_llamadas",
  "agenda_confirmada", "agenda_posible", "agenda_reprograma", "agenda_no_contesta",
  "agenda_cancela", "total_agendas",
  "atencion_venta", "atencion_venta_externa", "atencion_seguimiento", "atencion_declinado",
  "total_atencion", "atencion_agenda", "atencion_asociado", "atencion_enrolamiento",
  "atencion_certificados", "atencion_renovacion", "total_administrativa",
  "chats_inicial", "chats_medio", "chats_final", "tareas_inicial", "tareas_medio",
  "tareas_final", "caducadas_inicial", "caducadas_medio", "caducadas_final",
  "ventas_total", "ventas_presencial", "ventas_digital", "ventas_sin_tipo",
  "valor_final", "adicion", "descuento",
] as const

export type CampoSumable = (typeof CAMPOS_SUMABLES)[number]

/** El consolidado de varias filas: la suma campo a campo. */
export function consolidar(filas: FilaIndicadores[]): FilaIndicadores {
  const total = Object.fromEntries(CAMPOS_SUMABLES.map((c) => [c, 0])) as Record<
    CampoSumable,
    number
  >
  for (const f of filas) for (const c of CAMPOS_SUMABLES) total[c] += Number(f[c] ?? 0)
  return { staff_id: null, responsable_nombre: "Total", ...total }
}

/** Metas fijadas por la gerencia. Ratios en fracción; cantidades por jornada. */
export const METAS = {
  contactabilidad: 0.7,
  conversion_agenda: 0.6,
  venta_presencial: 0.7,
  volumen_agendas: 0.25,
  seguimiento: 0.55,
  agenda_a_venta: 0.3,
  contestadas_por_jornada: 45,
  agendas_atendidas_por_jornada: 6,
  dias_laborados: 0.8,
} as const

export interface Kpi {
  code: string
  nombre: string
  /** Cómo se calcula, en palabras. */
  formula: string
  unit: "porcentaje" | "cantidad"
  numerador: number
  denominador: number
  logrado: number | null
  meta: number
  /** Logrado ÷ meta. Es el "porcentaje de cumplimiento" que piden en todos los KPI. */
  efectividad: number | null
}

function kpi(
  code: string,
  nombre: string,
  formula: string,
  unit: Kpi["unit"],
  numerador: number,
  denominador: number,
  meta: number,
): Kpi {
  const logrado = safeRatio(numerador, denominador)
  return {
    code,
    nombre,
    formula,
    unit,
    numerador,
    denominador,
    logrado,
    meta,
    efectividad: logrado === null ? null : logrado / meta,
  }
}

/**
 * Los KPI con meta, sobre un consolidado.
 *
 * `diasHabiles` es cuántos días hábiles caben en el período por comercial;
 * `comerciales` cuántas personas están sumadas, para que el absentismo del
 * consolidado se mida contra hábiles × personas.
 */
export function kpisDe(t: FilaIndicadores, diasHabiles: number, comerciales: number): Kpi[] {
  const ventasGestion = t.llamada_efectiva + t.atencion_venta + t.atencion_venta_externa
  return [
    kpi(
      "contactabilidad",
      "Contactabilidad",
      "Llamadas contestadas ÷ total de llamadas",
      "porcentaje",
      t.llamadas_contestadas,
      t.total_llamadas,
      METAS.contactabilidad,
    ),
    kpi(
      "conversion_agenda",
      "Conversión de agenda",
      "Total de agendas ÷ llamadas contestadas",
      "porcentaje",
      t.total_agendas,
      t.llamadas_contestadas,
      METAS.conversion_agenda,
    ),
    kpi(
      "venta_presencial",
      "Venta presencial",
      "Ventas presenciales ÷ total de atención presencial",
      "porcentaje",
      t.atencion_venta + t.atencion_venta_externa,
      t.total_atencion,
      METAS.venta_presencial,
    ),
    kpi(
      "volumen_agendas",
      "Volumen de agendas",
      "Total de agendas ÷ total de llamadas",
      "porcentaje",
      t.total_agendas,
      t.total_llamadas,
      METAS.volumen_agendas,
    ),
    kpi(
      "seguimiento",
      "Seguimiento",
      "Llamadas de seguimiento ÷ total de llamadas",
      "porcentaje",
      t.llamada_seguimiento,
      t.total_llamadas,
      METAS.seguimiento,
    ),
    kpi(
      "agenda_a_venta",
      "Conversión de agenda a venta",
      "Ventas de la gestión (efectivas + presenciales) ÷ total de agendas",
      "porcentaje",
      ventasGestion,
      t.total_agendas,
      METAS.agenda_a_venta,
    ),
    kpi(
      "contestadas_por_jornada",
      "Llamadas contestadas al día",
      "Llamadas contestadas ÷ jornadas registradas · meta 45 por asesor",
      "cantidad",
      t.llamadas_contestadas,
      t.dias_laborados,
      METAS.contestadas_por_jornada,
    ),
    kpi(
      "agendas_atendidas_por_jornada",
      "Agendas efectivas al día",
      "Atención de agenda ÷ jornadas registradas · meta 6 por asesor",
      "cantidad",
      t.atencion_agenda,
      t.dias_laborados,
      METAS.agendas_atendidas_por_jornada,
    ),
    kpi(
      "dias_laborados",
      "Días laborados",
      "Jornadas registradas ÷ días hábiles del período",
      "porcentaje",
      t.dias_laborados,
      diasHabiles * Math.max(comerciales, 1),
      METAS.dias_laborados,
    ),
  ]
}

/** Promedios por jornada registrada (KPI 3). */
export function promediosDe(t: FilaIndicadores) {
  return {
    agendas: safeRatio(t.total_agendas, t.dias_laborados),
    contestadas: safeRatio(t.llamadas_contestadas, t.dias_laborados),
    atencion_presencial: safeRatio(t.total_atencion, t.dias_laborados),
  }
}

/**
 * Facturación total como la definió la gerencia: valor final − (adición +
 * descuento). Se muestra junto al valor final para que se vea la diferencia.
 */
export function facturacionTotal(t: FilaIndicadores): number {
  return t.valor_final - (t.adicion + t.descuento)
}

/** Días hábiles de lunes a sábado dentro de un rango, ambos inclusive. */
export function diasHabilesEnRango(desde: string, hasta: string): number {
  const a = new Date(`${desde}T00:00:00Z`)
  const b = new Date(`${hasta}T00:00:00Z`)
  let cuenta = 0
  for (let d = new Date(a); d <= b; d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() !== 0) cuenta++
  }
  return cuenta
}

/** Los meses (`YYYY-MM-01`) que toca un rango. */
export function mesesDe(desde: string, hasta: string): string[] {
  const meses: string[] = []
  let cursor = `${desde.slice(0, 7)}-01`
  const fin = `${hasta.slice(0, 7)}-01`
  while (cursor <= fin) {
    meses.push(cursor)
    const [y, m] = cursor.split("-").map(Number)
    const d = new Date(Date.UTC(y, m, 1))
    cursor = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`
  }
  return meses
}

/** Último día de un mes `YYYY-MM-01`, como `YYYY-MM-DD`. */
export function finDeMes(mes: string): string {
  const [y, m] = mes.split("-").map(Number)
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}
